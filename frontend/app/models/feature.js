import DS from 'ember-data';
import attr from 'ember-data/attr';
//import Fragment from 'model-fragments/fragment';

export default DS.Model.extend({
  workspaceId: DS.belongsTo('workspace'),
  parentId: DS.belongsTo('feature'),
  name: attr('string'),
  range: attr('array'),
  features: DS.hasMany('feature')
});
