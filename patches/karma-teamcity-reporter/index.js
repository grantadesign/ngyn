var util = require('util');
var fs = require('fs');

var escapeMessage = function (message) {
  if(message === null || message === undefined) {
    return '';
  }

  return message.toString().
    replace(/\|/g, '||').
    replace(/\'/g, '|\'').
    replace(/\n/g, '|n').
    replace(/\r/g, '|r').
    replace(/\u0085/g, '|x').
    replace(/\u2028/g, '|l').
    replace(/\u2029/g, '|p').
    replace(/\[/g, '|[').
    replace(/\]/g, '|]');
};

var formatMessage = function() {
  var args = Array.prototype.slice.call(arguments);

  for (var i = args.length - 1; i > 0; i--) {
    args[i] = escapeMessage(args[i]);
  }
  return util.format.apply(null, args) + '\n';
};


var TeamcityReporter = function(baseReporterDecorator) {
  baseReporterDecorator(this);
  
  this.adapters = [fs.writeSync.bind(fs.writeSync, 1)];

  this.TEST_IGNORED  = '##teamcity[testIgnored name=\'%s\']';
  this.SUITE_START   = '##teamcity[testSuiteStarted name=\'%s\']';
  this.SUITE_END     = '##teamcity[testSuiteFinished name=\'%s\']';
  this.TEST_START    = '##teamcity[testStarted name=\'%s\']';
  this.TEST_FAILED   = '##teamcity[testFailed name=\'%s\' message=\'FAILED\' details=\'%s\']';
  this.TEST_END      = '##teamcity[testFinished name=\'%s\' duration=\'%s\']';
  this.BROWSER_START = '##teamcity[browserStart name=\'%s\']';
  this.BROWSER_END   = '##teamcity[browserEnd name=\'%s\']';

  this.onRunStart = function(browsers) {
    var self = this;
    this.browserResults = {};
    browsers.forEach(function(browser) {
      self.browserResults[browser.id] = {
        name: browser.name,
        log : [],
        lastSuite : null
      };
    });
  };

  this.specSuccess = function(browser, result) {
    var log = this.getLog(browser, result);
    var testName = result.description;

    log.push(formatMessage(this.TEST_START, testName));
    log.push(formatMessage(this.TEST_END, testName, result.time));
  };

  this.specFailure = function(browser, result) {
    var log = this.getLog(browser, result);
    var testName = result.description;

    log.push(formatMessage(this.TEST_START, testName));
    log.push(formatMessage(this.TEST_FAILED, testName, JSON.stringify(result.log)));
    log.push(formatMessage(this.TEST_END, testName, result.time));
  };

  this.specSkipped = function(browser, result) {
    var log = this.getLog(browser, result);
    var testName = result.description;

    log.push(formatMessage(this.TEST_IGNORED, testName));
  };

  this.onRunComplete = function() {
    var self = this;

    Object.keys(this.browserResults).forEach(function(browserId) {
      var browserResult = self.browserResults[browserId];
      var log = browserResult.log;
      if(browserResult.lastSuite) {
        log.push(formatMessage(self.SUITE_END, browserResult.lastSuite));
      }
      self.write(formatMessage(self.BROWSER_START, browserResult.name));
      self.write(log.join(''));
      self.write(formatMessage(self.BROWSER_END, browserResult.name));
    });
  };

  this.getLog = function(browser, result) {
    var browserResult = this.browserResults[browser.id];
    var suiteName = result.suite.join(' ');
    var log = browserResult.log;
    if(browserResult.lastSuite !== suiteName) {
      if(browserResult.lastSuite) {
        log.push(formatMessage(this.SUITE_END, browserResult.lastSuite));
      }
      browserResult.lastSuite = suiteName;
      log.push(formatMessage(this.SUITE_START, suiteName));
    }
    return log;
  };

};

TeamcityReporter.$inject = ['baseReporterDecorator'];

module.exports = {
  'reporter:teamcity': ['type', TeamcityReporter]
};
