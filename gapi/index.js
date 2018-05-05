

function decodeRaw(str) {

  /*
   * JavaScript base64 / base64url encoder and decoder
   */

  var b64c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"   // base64 dictionary
  var b64u = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"   // base64url dictionary
  var b64pad = '='

  /* base64_encode_data
   * Internal helper to encode data to base64 using specified dictionary.
   */
  function base64_encode_data(data, len, b64x) {
    var dst = ""
    var i

    for (i = 0; i <= len - 3; i += 3)
    {
      dst += b64x.charAt(data.charCodeAt(i) >>> 2)
      dst += b64x.charAt(((data.charCodeAt(i) & 3) << 4) | (data.charCodeAt(i+1) >>> 4))
      dst += b64x.charAt(((data.charCodeAt(i+1) & 15) << 2) | (data.charCodeAt(i+2) >>> 6))
      dst += b64x.charAt(data.charCodeAt(i+2) & 63)
    }

    if (len % 3 == 2)
    {
      dst += b64x.charAt(data.charCodeAt(i) >>> 2)
      dst += b64x.charAt(((data.charCodeAt(i) & 3) << 4) | (data.charCodeAt(i+1) >>> 4))
      dst += b64x.charAt(((data.charCodeAt(i+1) & 15) << 2))
      dst += b64pad
    }
    else if (len % 3 == 1)
    {
      dst += b64x.charAt(data.charCodeAt(i) >>> 2)
      dst += b64x.charAt(((data.charCodeAt(i) & 3) << 4))
      dst += b64pad
      dst += b64pad
    }

    return dst
  }

  /* base64_encode
   * Encode a JavaScript string to base64.
   * Specified string is first converted from JavaScript UCS-2 to UTF-8.
   */
  function base64_encode(str) {
    var utf8str = unescape(encodeURIComponent(str))
    return base64_encode_data(utf8str, utf8str.length, b64c)
  }

  /* base64url_encode
   * Encode a JavaScript string to base64url.
   * Specified string is first converted from JavaScript UCS-2 to UTF-8.
   */
  function base64url_encode(str) {
    var utf8str = unescape(encodeURIComponent(str))
    return base64_encode_data(utf8str, utf8str.length, b64u)
  }

  /* base64_charIndex
   * Internal helper to translate a base64 character to its integer index.
   */
  function base64_charIndex(c) {
    if (c == "+") return 62
    if (c == "/") return 63
    return b64u.indexOf(c)
  }

  /* base64_decode
   * Decode a base64 or base64url string to a JavaScript string.
   * Input is assumed to be a base64/base64url encoded UTF-8 string.
   * Returned result is a JavaScript (UCS-2) string.
   */
  function base64_decode(data) {
    var dst = ""
    var i, a, b, c, d, z

    for (i = 0; i < data.length - 3; i += 4) {
      a = base64_charIndex(data.charAt(i+0))
      b = base64_charIndex(data.charAt(i+1))
      c = base64_charIndex(data.charAt(i+2))
      d = base64_charIndex(data.charAt(i+3))

      dst += String.fromCharCode((a << 2) | (b >>> 4))
      if (data.charAt(i+2) != b64pad)
        dst += String.fromCharCode(((b << 4) & 0xF0) | ((c >>> 2) & 0x0F))
      if (data.charAt(i+3) != b64pad)
        dst += String.fromCharCode(((c << 6) & 0xC0) | d)
    }

    dst = decodeURIComponent(escape(dst))
    return dst
  }

  /* base64url_sniff
   * Check whether specified base64 string contains base64url specific characters.
   * Return true if specified string is base64url encoded, false otherwise.
   */
  function base64url_sniff(base64) {
    if (base64.indexOf("-") >= 0) return true
    if (base64.indexOf("_") >= 0) return true
    return false
  }

  return base64_decode(str);


}

var modtask = function(config) {

  var mimeStore = null;
  var storeConfig = config.mimestore || {};
  if (!storeConfig.modhandler) storeConfig.modhandler = 'fake';
  mimeStore = modtask.ldmod('rel:../mimestore/' + storeConfig.modhandler)(storeConfig);
  if (!mimeStore.success) {
    return modtask.Log('mimeStore failed: ' + mimeStore.reason);
  }


  gapiConfig = config.gapi || {};

  var today = new Date();
  var date = today.getFullYear()+'/'+(today.getMonth()+1)+'/'+today.getDate();

  var query = gapiConfig.query || 'after:' + date;

  if (config.verbose) modtask.Log('query=' + query);

  var totalDownloads = 0;

  var dump = null;
  function setupAuth() {
    function parseChromeDump(dumpStr) {
      if (config.verbose) modtask.Log('Parsing config');
      var ret = null;
      try {
        ret = {};
        ret.url = dumpStr.split('Request URL:')[1].split('\n')[0];
        if (config.verbose) modtask.Log('URL ' + ret.url);
        var headersSection = dumpStr.split('Request Headers')[1];
        headersSection = headersSection.split('\n');
        var i, item;
        ret.headers = {};
        for (i = 0; i < headersSection.length; ++i) {
          item = headersSection[i];
          if (item == '') continue;
          var index = item.indexOf(':');
          if (index == -1) break;
          if (index < 1) continue;
          ret.headers[item.substr(0, index)] = item.substr(index + 1, item.length - index - 1);
        }
      } catch (e) {
        modtask.Log('error parsing dump file: ' + e.message);
        ret = null;
      }
      return ret;
    }

    var fs = require('fs');
    dump = parseChromeDump(fs.readFileSync(gapiConfig.sessionfilepath).toString());
    if (dump == null) return;

    // delete caching headers
    delete dump.headers['if-none-match'];
    // do this, otherwise the returned data might be gzipped, etc.
    delete dump.headers['accept-encoding'];
  }

  function makeRequest(req, cb) {
    var reference = dump.url;
    url = 'https://content.googleapis.com' + req + '&key=' + reference.split('key=')[1];
    var request = require('request');
    var options = {
      url: url,
      headers: dump.headers
    };
    if (config.verbose) modtask.Log('Making call ' + url);
    function callback(error, response, body) {
      // response will have:
      // statusCode
      // headers
      // body
      if (!error) {
        if (response.headers['content-encoding']) {
          cb({
            success: false,
            reason: 'Warning, returned content encoded as ' + response.headers['content-encoding'] + '. Will not show data'
          });
        } else {
          if (response.headers['content-type'].indexOf('application/json') == 0) {
            body = JSON.parse(body);
          };

          if (response.statusCode == 200) {
            cb({
              success: true,
              data: body
            });
          } else {
            cb({
              success: false,
              data: body
            });
          }
        }
      } else {
        cb({
          success: false,
          data: 'couldnt get data (' + response.statusCode + '): ' + error
        });
      }
    }
    request(options, callback);
  }


  function downloadMessages(messages, cb) {
    var i=0;
    var next = function() {
      if (messages.length <= i) {
        cb({
          success: true
        });
      } else {
        var msgid = messages[i++].id;
        if (config.verbose)  modtask.Log('Download msg ' + msgid);
        makeRequest('/gmail/v1/users/me/messages/' + msgid + '?format=raw', function(outcome) {
          if (outcome.success) {
            totalDownloads++;
            var dataBuffer = outcome.data.raw;
            var guid = outcome.data.id;
            if (config.verbose) modtask.Log('decode data of length ' + outcome.data.raw.length);
            /* When the raw data gets too big (example 46,466,372) the node process blows up and runs out of memory

            <--- Last few GCs --->
            17615 ms: Scavenge 1398.5 (1456.6) -> 1398.5 (1456.6) MB, 0.2 / 0 ms (+ 3.0 ms in 1 steps since last GC) [allocation failure] [incremental marking delaying mark-sweep].
            18221 ms: Mark-sweep 1398.5 (1456.6) -> 1398.1 (1456.6) MB, 606.0 / 0 ms (+ 3.4 ms in 2 steps since start of marking, biggest step 3.0 ms) [last resort gc].
            18907 ms: Mark-sweep 1398.1 (1456.6) -> 1398.1 (1456.6) MB, 686.5 / 0 ms [last resort gc].
            */
            if (outcome.data.raw.length < 40000000) {
              try {
                // https://developers.google.com/gmail/api/v1/reference/users/messages/get
                // the raw is base64url encoded
                // been seeing 'URI malformed' error
                dataBuffer = decodeRaw(outcome.data.raw);
              } catch (e) {
                modtask.Log('WARNING, decodeFailed: ' + e.message);
                guid += '.decodeerror';
              }
            } else {
              modtask.Log('WARNING, too big to decode');
              guid += '.toobig';
            }

            mimeStore.addItems([{
              messageUTCTimestamp: null,
              sourceid: 'gapi',
              guid: guid,
              size: outcome.data.sizeEstimate,
              // Is this binary? What is the encoding here?
              payload: dataBuffer
            }
            ]);
            next();
          }
        });
      }
    }
    next();
  }



  var getMessageList = function(pageToken, cb) {
    if (config.verbose) modtask.Log('getMessageList (query=' + query + ') page=' + pageToken);

    if (!pageToken)  {
      return cb({
        success: true
      });
    };

    makeRequest('/gmail/v1/users/me/messages?maxResults=100' +
        (pageToken != '1' ?  '&pageToken=' + pageToken  : '' ) +
        (true ? '&q=' + encodeURIComponent(query) : ''), function(outcome) {
      // nextPageToken can be used to continue grabbing stuff
      if (!outcome.success)
        return cb(outcome);

      if (config.verbose) modtask.Log('resultSizeEstimate ' + outcome.data.resultSizeEstimate);
      if (outcome.data.resultSizeEstimate == 0) {
        return cb({ success: true });
      }
      var messages = outcome.data.messages;
      downloadMessages(messages, function() {
        getMessageList(outcome.data.nextPageToken, cb);
      });
    });
  };

  setupAuth();
  if (dump == null) return ;
  getMessageList(1, function(outcome) {
    modtask.Log('totalDownloads: ' + totalDownloads);
    console.log(outcome);
  });
}

