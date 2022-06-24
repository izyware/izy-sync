/* izy-loadobject nodejs-require */
module.exports = (function() {
    const exports = function() {};

    exports.convertHARToRequest = function(queryObject, cb) {
        const { pathToHARFile, url } = queryObject;
        if (!url) return cb({ reason: 'specify url' });
        if (!pathToHARFile) return cb({ reason: 'specify pathToHARFile' });
        
        let replayRequest = {};

        entries = JSON.parse(require('fs').readFileSync(pathToHARFile).toString('utf-8')).log.entries;
        entries.forEach(item => {
            const { request, response } = item;
            if (request.url.indexOf(queryObject.url) >= 0) {
                replayRequest.url = request.url;
                replayRequest.method = request.method;
                replayRequest.headers = {};
                request.headers.forEach(h => {
                    if (h.name.indexOf(':') == 0) return;
                    replayRequest.headers[h.name] = h.value;
                });
                replayRequest.body = request.postData.text;
            }
        });
        return cb({ success: true, data: replayRequest });
    }

    exports.check = function(queryObject, cb) {
        exports.doChain([
            ['//inline/?convertHARToRequest', queryObject],
            chain =>chain(['net.httprequest', chain.get('outcome').data]),
            chain => {
                const outcome = chain.get('outcome');
                console.log(outcome.responseText);
                if (outcome.status != 200) return chain(['outcome', { reason: `status ${outcome.status}` }]);
                chain(['outcome', { success: true, data: 'OK' }]);
            },
            ['continue']
        ]);
    };
  
    return exports;
  })();
  