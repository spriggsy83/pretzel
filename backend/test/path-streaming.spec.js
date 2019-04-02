'use strict';

var assert = require('chai').assert
var http = require('superagent')
var qs = require('qs')
var _ = require('lodash')
var EventSource = require('eventsource')

describe('path-streaming', function() {
  var app, server, endpoint, smtp, database, parse
  var datasetHelper, eventsource, load

  var userEmail, userPassword, userId, userToken

  var ds, blocks, path
  /** This value is used in SSE packet event id to signify the end of the cursor in pathsViaStream. */
  const SSE_EventID_EOF = '-1';

  before(async function() {
    console.log("Before all");
    var environment = require('./helpers/environment')

    process.env.AUTH = "ALL"
    process.env.EMAIL_VERIFY = "NONE"
    process.env.EMAIL_HOST = ""
    process.env.EMAIL_PORT = ""
    process.env.EMAIL_FROM = ""
    process.env.EMAIL_ADMIN = ""

    // scrubbing dependencies (if loaded)
    Object.keys(require.cache).forEach(function(key) { delete require.cache[key] })

    app = require('../server/server')
    endpoint = require('./helpers/api').endpoint
    database = require('./helpers/database')
    datasetHelper = require('./helpers/dataset')
    eventsource = require('./helpers/eventsource-prom.js')
    load = require('../common/utilities/load')

    let Client = app.models.Client
    // Dataset = app.models.Dataset

    ds = {
      url: "https://github.com/plantinformatics/pretzel-data/raw/master/",
      path: "",
      filename: "myMap",
      name: "myMap",
      ext: ".json"
    }
    blocks = null

    userEmail = "test@test.com"
    userPassword = "test"
    userId = null
    userToken = null

    try {
      // console.log("Wipe db from previous tests");
      // app.dataSources.db.automigrate();

      console.log("Delete test user from previous tests");
      await database.destroyUserByEmail(app.models, userEmail)

      console.log("Create test user");
      await Client.create({email: userEmail, password: userPassword}, (err, instance) => {
        console.log('instance => ', instance);
        userId = instance.id
      })

      // console.log("Start server");
      // server = app.listen();

      console.log("Login test user");
      await http
        .post(`${endpoint}/Clients/login`)
        .send({ email: userEmail, password: userPassword })
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .then(res => {
          // console.log('res.body => ', res.body);
          userToken = res.body.id
          console.log('userToken => ', userToken);
        })

      /* Previous dataset should be deleted here, but permissions prevents this */
      
    } catch(err) {
      // console.log('err => ', err);
    }
  })

  after(function(){
    console.log("After all");
  })

  it("Test Mocha", function(done) {
    // console.log('app.models => ', app.models);
    console.log("In test");
    assert.equal(true, true)
    done()
  })

  describe("MyMap3 tests", function() {
    before(async function() {
      blocks = null
      path = "/Blocks/pathsViaStream"
      ds.name = "myMap3"
      ds.filename = "myMap3"

      blocks = await datasetHelper.setup({ds, userToken})
      .then(res => {
        console.log("Successfully get blocks");
        return res.body.blocks
      })
      .catch(err => {
        // console.log('err => ', err);
        console.log("Failed to get blocks");
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err));
      })
    })

    after(async function() {
      await datasetHelper.del({name: ds.name, userToken})
        .then(res => {
          console.log("Dataset deleted");
          console.log('res.status => ', res.status);
        })
        .catch(err => {
          console.log("Deleting dataset failed");
          console.log('err.status => ', err.status);
          console.log("err => ", getErrMessage(err));
        })
    })

    it("'MyMap' exists", async function() {
      // console.log('myMap2 => ', myMap);
      // console.log('myMap.name => ', myMap.name);
      await http
        .get(`${endpoint}/Datasets/test_pzl_${ds.name}`)
        .set('Accept', 'application/json')
        .set('Authorization', userToken)
        .then(res => {
          // console.log('test res.body => ', res.body);
          assert.equal(res.status, 200);
        })
    })

    it("Stream features, 1 path", function(done) {
      this.timeout(2000)
      // console.log('blocks => ', blocks);
      let features = []
      let blockId0 = blocks[1].id,
          blockId1 = blocks[2].id,
          intervals = {
            axes: [ {
              domain: [0, 100],
              range: 400
            }, {
              domain: [0, 100],
              range: 400
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true
          }

      let url = `${endpoint}/Blocks/pathsViaStream`+
                `?access_token=${userToken}`+
                `&blockA=${blockId0}`+
                `&blockB=${blockId1}`+
                `&${qs.stringify({ intervals })}`

      // console.log('url => ', url);
      var source = new EventSource(url, {withCredentials: true});
      let count = 0

      function onMessage(e) {
        ++count
        // if (trace_paths > 2)
        // console.log('onMessage', e, e.type, e.data, arguments);
        if (e.lastEventId === SSE_EventID_EOF) {
          console.log('count => ', count);
          // This is the end of the stream
          source.close()
          done()
        }
        else {
          let data = JSON.parse(e.data)
          console.log('data => ', data)

        }
      }

      source.addEventListener('pathsViaStream', onMessage, false);
      // source.onmessage = onMessage;

      source.addEventListener('open', function(e) {
        console.log("Connection was opened", e.type, e)
      }, false)
      // source.addEventListener('close', function(e) {
      //   console.log("Connection was closed", e.type, e);
      //   done()
      // }, false);
      function onError(e) {
        let state = e.eventPhase // this.readyState seems constant.
        const stateName = ['CONNECTING', 'OPEN', 'CLOSED']
        console.log('listenEvents', e.type, e, this, ".readyState", this.readyState, state, stateName[state], e)
        if (state === EventSource.CLOSED) {
          done()
        }
        else if (state == EventSource.CONNECTING) {
        }
        else
          throw e;
      };
      source.onerror = onError; 

    })

    it("Stream features, repeat features", async function() {
      this.timeout(2000)
      // console.log('blocks => ', blocks);
      let features
      let blockId0 = blocks[0].id,
          blockId1 = blocks[3].id,
          intervals = {
            axes: [ {
              domain: [0, 100],
              range: 400
            }, {
              domain: [0, 100],
              range: 400
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true
          }

      await eventsource.allData({path, blockId0, blockId1, intervals, userToken})
        .then(data => {
          console.log('features => ', data);
          features = data
        }, err => {
          console.log('err => ', err);
        })

      assert.isArray(features)
      // 2 unique features
      assert.equal(features.length, 2)


      let numPaths = calcNumPaths(features)

      console.log('numPaths => ', numPaths);
      
      // Cross product of 3 x 2 Marker A, 1 x 2 Marker B = 8
      assert.equal(numPaths, 8)

    })
  })

})

function calcNumPaths(features) {
  return features.map(feature => {
    console.log('feature => ', feature);
    return [0, 1].map(block => {
      console.log(`feature.alignment[${block}].repeats.features => `, feature.alignment[block].repeats.features);
      return feature.alignment[block].repeats.features.length
    })
  }).reduce((total, array) => {
    console.log('array[0], array[1] => ', array[0], array[1]);
    return total + array[0] * array[1]
  }, 0 )
}

function getErrMessage(err) {
  let temp = _.property("response.error.text")(err)
  if(!temp) {
    return err
  }
  let temp2 = _.property("error.message")(JSON.parse(temp))
  return temp2
}
