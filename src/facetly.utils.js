(function () {
  'use strict';

  function FacetlyUtils($log, $q) {

    var service = {};

    service.setFilters = function (filteredBy, facets) {
      var filters = [];

      if (_.isObject(filteredBy)) {
        filters = _.chain(facets)
                    .filter(function (facet) {
                      return _.keys(filteredBy).indexOf(facet.id) !== -1;
                    })
                    .filter(function (facet) {
                      return facet.isLoading === false;
                    })
                    .map(function (facet) {
                      return service.setFilter(filteredBy, facet);
                    })
                    .value();
      }

      return filters;
    };

    service.setFilter = function (filteredBy, facet) {
      if (!_.has(filteredBy, facet.id) || filteredBy[facet.id] === undefined) {
        return;
      }

      if (facet.type === 'select' || facet.type === 'hierarchy') {
        if (facet.multiselect) {
          return _.assign(
            {},
            facet,
            {
              value: _.map(filteredBy[facet.id], function (f) {
                var option = _.find(facet._options, { id: f });
                return { id: f, title: option && option.title || 'n/a' };
              })
            }
          );
        } else {
          var option = _.find(facet._options, { id: filteredBy[facet.id] });
          return _.assign(
            {},
            facet,
            {
              value: {
                id: filteredBy[facet.id],
                title: option && option.title || 'n/a'
              }
            }
          );
        }
      } else {
        return _.assign({}, facet, { value: filteredBy[facet.id] });
      }
    };

    service.setFacets = function (facets, facetLoadedCallback) {
      return _.map(facets, function (facet) {
        facet.isLoading = true;
        facet._options = [];
        $q.when(typeof facet.options === 'function' ? facet.options() : facet.options)
          .then(function (results) {
            facet._options = results;
            facet.isLoading = false;
            if (_.isFunction(facetLoadedCallback)) {
              facetLoadedCallback(facet);
            }
          });

        return facet;
      });
    };

    service.findFilterByKey = function (filters, key, value) {
      //rewrite using _.find
      return _.findIndex(filters, function (filter) {
        return filter[key] === value;
      });
    };

    service.addFilter = function (filters, filter) {
      var idx = this.findFilterByKey(filters, 'id', filter.id);
      return idx === -1 ? filters.concat([filter]) : filters;
    };

    service.removeFilter = function (filters, key) {
      var idx = this.findFilterByKey(filters, 'id', key);
      return idx !== -1 ? filters.slice(0, idx).concat(filters.slice(idx + 1)) : filters;
    };

    service.removeAllFilters = function () {
      return [];
    };

    service.getValues = function (value, type) {
      if (type === 'select' || type === 'hierarchy') {
        if (_.isArray(value)) {
          value = _.map(value, function (v) {
            return v.id;
          });
        } else if (_.isObject(value)) {
          value = value.id;
        }
      }

      return value;
    };

    service.updateModel = function (filters, facets, filteredBy) {
      for (var i = 0; i < facets.length; i++) {
        var filter = _.find(filters, {id: facets[i].id});
        if (!_.isUndefined(filter) && !_.isEmpty(filter.value)) {
          filteredBy[filter.id] = service.getValues(filter.value, filter.type);
        } else {
          delete filteredBy[facets[i].id];
        }
      }

      return filteredBy;
    };

    service.updateAppliedFilters = function (filters) {
      var appliedFilters = {};

      for (var i = 0; i < filters.length; i++) {
        if (!_.isUndefined(filters[i].value)) {
          appliedFilters[filters[i].label] = this.getValueForFilterByType(filters[i]);
        }
      }

      return appliedFilters;
    };

    service.getValueForFilterByType = function (filter) {
      switch (filter.type) {
        case 'select':
          if (filter.multiselect) {
            return _.map(filter.value, function (v) { return v.title; });
          } else {
            return filter.value.title;
          }
          break;
        case 'hierarchy':
          if (filter.multiselect) {
            return _.map(filter.value, function (v) { return v.title; });
          } else {
            return filter.value.title;
          }
          break;
        default:
          return filter.value;
      }
    };

    service.flatten = function (array, flat) {
      flat = [] || flat;
      _.forEach(array, function (item) {
        flat.push({ id: item.id, title: item.title });

        if (item.categories && item.categories.length) {
          flat = flat.concat(service.flatten(item.categories, flat));
        }
      });

      return flat;
    };

    service.getFacetIds = function (value, available) {
      if (_.isArray(value)) {
        return value.map(function (v) {
          return _.find(available, { title: v }).id;
        });
      } else {
        return _.find(available, { title: value }).id;
      }
    };

    service.validateValues = function (filters, filteredBy) {
      return _.map(filters, function (filter) {
        filter = _.assign({}, filter);

        // Cleanup
        delete filter.isValid;
        delete filter.messages;

        if (filter.validation && filter.validationMessages) {
          _.forEach(filter.validation, function (func, key) {
            if (typeof func === 'function' && !_.isUndefined(filter.validationMessages[key]) && !func(filteredBy[filter.id])) {
              filter.isValid = false;
              filter.messages = filter.messages || [];
              filter.messages.push(filter.validationMessages[key]);
            }
          });
        }

        return filter;
      });
    };

    service.collectValidationErrors = function (filters) {
      return _.chain(filters)
              .filter(function (filter) {
                return filter.messages && filter.messages.length;
              })
              .map(function (filter) {
                var errors = [];
                _.forEach(filter.messages, function (message) {
                  errors.push(filter.label + ': ' + message);
                });

                return errors;
              })
              .flatten()
              .value();
    };

    return service;
  }

  FacetlyUtils.$inject = ['$log', '$q'];

  angular.module('ngFacetly')
    .service('FacetlyUtils', FacetlyUtils);

})();
