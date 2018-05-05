function getStream() {
  var Stream = require('stream');
  var ws = new Stream;
  ws.writable = true;
  ws.bytes = 0;
  ws.buf = [];

  ws.write = function (buf) {
    ws.buf = ws.buf.concat(buf);
    ws.bytes += buf.length;
  }

  ws.end = function (buf) {
    if (arguments.length) ws.write(buf);
    ws.writable = false;
  }
  return ws;
}


var modtask = function (config) {
  var mimeStore = null;
  var storeConfig = config.mimestore || {};
  if (!storeConfig.modhandler) storeConfig.modhandler = 'fake';
  mimeStore = modtask.ldmod('rel:../mimestore/' + storeConfig.modhandler)(storeConfig);
  if (!mimeStore.success) {
    return modtask.Log('mimeStore failed: ' + mimeStore.reason);
  }

  var connectionString = config.imap.user + ' on ' + config.imap.host;

  var Imap = require('imap');
  var imap = new Imap({
    user: config.imap.user,
    password: config.imap.password,
    host: config.imap.host,
    port: config.imap.port,
    tls: config.imap.tls
  });
  function openInbox(cb) {
    imap.openBox(
      'inbox',
     true, cb);
  }
  var alreadyDisconnected = false;
  imap.once('ready', function () {
    modtask.Log('Opening inbox');
    openInbox(function (err, box) {
      if (err) throw err;
      var searchConfig = config.imap.search || { key1: 'ALL', key2: 'SINCE', key3: 'June 24, 2016' };
      imap.search([searchConfig.key1, [searchConfig.key2, searchConfig.key3] ], function(err, results) {
        if (err) throw err;
        var f = imap.fetch(results, {
          // The entire message (header + body)
          bodies: ''
        });


        f.on('message', function(msg, seqno) {
          var msgStream = null;

          // need to buffer this since x-gm-msgid and date are not available until after this is done
          msg.on('body', function(stream, info) {
            msgStream = getStream();
            stream.pipe(msgStream);
          });

          // Gets called after the stream is encded, it has things like date, etc.
          msg.once('attributes', function(attrs) {
            msgStream.attrs = attrs;
          });

          // will get called after the stream has ended AND attributes is called
          msg.once('end', function() {
            var dateStr = msgStream.attrs.date + '';
            try {
              dateStr = msgStream.attrs.date.toISOString();
            } catch(e) {}

            var guid = dateStr.toLowerCase().replace(/\s/g, '_').replace(/\//g, '__') + '_' + msgStream.attrs.uid;
            mimeStore.addItems([{
                messageUTCTimestamp: null,
                sourceid: config.imap.user,
                guid: guid,
                size: msgStream.bytes,
                // Is this binary? What is the encoding here?
                payload: msgStream.buf
              }
            ]);
          });
        });

        f.once('error', function(err) {
          modtask.Log('Fetch error: ' + err);
        });
        f.once('end', function() {
          modtask.Log('*** Done fetching all messages!');
          modtask.Log('*** Disconnecting from: ' + connectionString);
          alreadyDisconnected = true;

          imap.end();
        });
      });
    });
  });

  imap.once('error', function (err) {
    if (alreadyDisconnected) return;
    console.log(err);
  });

  imap.once('end', function () {
    modtask.Log('*** Connection ended');
  });

  modtask.Log('*** Connecting to: ' + connectionString);
  imap.connect();
}

