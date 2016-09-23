import Ember from 'ember';

export default Ember.Route.extend({
  queryParams: {
    mapsToView: {
      // We want changes in the URL mapsToView query parameter to trigger
      // a model refresh.
      refreshModel: true
    }
  },

  serializeQueryParam: function(value, urlKey, defaultValueType) {
    // This serializes what gets passed to the link-to query parameter.
    // Without it, an array simply gets JSON.stringified, for example:
    // [1,2] becomes "[1,2]" and treated as a string.
    if (defaultValueType === 'array') {
      return value;
    }
    return '' + value;
  }, 

  deserializeQueryParam: function(value, urlKey, defaultValueType) {
    console.log("deserializeQueryParam, params:");
    console.log(value);
    console.log(urlKey);
    console.log(defaultValueType);
    return value;
  },

  model(params) {

    // Get all available maps.
    var maps = this.get('store').findAll('mapset');
    this.controllerFor("mapview").set("availableMaps", maps);
    maps.then(function(maplist){
      maplist.forEach(function(map) {
        var exMaps = [];
        if (params.mapsToView) {
          for (var i=0; i < params.mapsToView.length; i++) {
            exMaps.push(params.mapsToView[i]);
          }
        }
        map.set('extraMaps', exMaps);
      });
    });
    
    let promises = {};
    let that = this;

    params.mapsToView.forEach(function(param) {

      promises[param] = that.get('store').findRecord('mapset', param).then(function(mapset) {
          console.log(mapset.get('name'));
          return mapset.get('maps');
        }).then(function(maps) {
          let markermaplocations = maps.getEach('markermaplocations');
          return Ember.RSVP.all(markermaplocations).then(function() {
            return maps;
          });
        });

    });

    let preparedData = {};

    return Ember.RSVP.hash(promises).then(function(results) {
      params.mapsToView.forEach(function(param) {
        preparedData[param] = {};
        results[param].forEach(function(m) {
          preparedData[param][m.get('name')] = [];
        });
      });
      that.controllerFor("mapview").set("mapData", params.mapsToView);
      return preparedData;
    });
  }
});
