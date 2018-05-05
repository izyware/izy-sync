
var modtask = function (config) {
  var persistentStore = null;
  if (!config.dataservice) {
    persistentStore = require('./persistentStore')(modtask, config);
  } else {
    persistentStore = modtask.ldmod('rel:../cloudStore')(config);
  }

  persistentStore.runQuery2(config.query, function(data) {
    console.log(data);
  }, function(outcome) {
    modtask.Log('Error: ' + outcome.reason);
  });
}
