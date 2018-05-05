
var modtask = function (config) {

  var persistentStore = null;
  switch (config.source.type) {
    case 'emlfolder':
      persistentStore = modtask.ldmod(`rel:../${config.source.type}`)(config.source);
      break;
    default:
      modtask.Log('Unknown config.source.type: ' + config.source.type);
      return ;
  }

  if (!config.destination.groupid) {
    return modtask.Log('Unknown config.destination.groupid. Pleas specifiy a number');
  }

  if (!config.source.id) {
    return modtask.Log('config.source.id Please specifiy a uniq id that can be used to generate the guid for the raw email');
  }

  persistentStore.query(function(outcome) {
    if (outcome.success) {
      modtask.Log(`source.len ${outcome.items.length}, totalSize: ${outcome.totalSize}`);
      var i;
      for(i=0; i < outcome.items.length; ++i) {
        var item = outcome.items[i];
        modtask.Log(`Consume ${i}`)
        persistentStore.consumeItem(item, function(payload) {
          payload = payload.toString();

          var base64field = function(val) {
            return "NOQUOTE__FROM_BASE64('" + modtask.ldmod('encodedecode/base64').enc(val) + "')";
          };

          var dest = {
            groupid: config.destination.groupid,
            // sha1 - Used as a reference point for source, so that next time a source needs to be synced timestamps can be used
            sourceid: modtask.ldmod('encodedecode/sha1').sha1(config.source.id),
            // sha1- Used to uniquely id the message to the server
            guid: modtask.ldmod('encodedecode/sha1').sha1(config.source.id + '' + item.guid),
            size: item.size,
            // optional
            metadata: base64field(JSON.stringify({ type: config.source.type, sourceid: config.source.id, itemguid: item.guid })),
            payload: base64field(payload)
          };

          var cloudStore = modtask.ldmod('rel:../cloudStore')(config.destination);

          try {
            var parsed = modtask.ldmod('net/mime/main').parseMsg(payload);

            var res = modtask.ldmod('net/mime/datetime').parse(parsed.date);
            if (res.success) {
              dest.messageUTCTimestamp = "NOQUOTE__CONVERT_TZ(STR_TO_DATE('" + parsed.date + "','%a, %e %M %Y %k:%i:%s'), '" + res.timezone + "', '+00:00')"
            } else {
              dest.messageUTCTimestamp = "NOQUOTE__NOW()";
              cloudStore.markObjectAs(dest, 'conversionerror');
            }
            ;
          } catch(e) {
            cloudStore.markObjectAs(dest, 'conversionerror');
            dest.payload = e.message;
            modtask.Log('conversionerror ' + e.message);
          }
          console.log(dest);
          cloudStore.addItems([dest],function(outcome) {
            if(!outcome.success) {
              modtask.Log('cloudStore additem: ' + outcome.reason);
            } else {
              modtask.Log('cloudStore.addItems successful');
            }
          })
        });
      }
    } else {
      modtask.Log('Error querying the source: ' + outcome.reason);
    }
  }, config.source.tags, config.source.limit);
}