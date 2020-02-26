var RDFQuery = require('./rdfquery')
var T = RDFQuery.T
var rdf = require('rdf-ext')
var TermFactory = require('./rdfquery/term-factory')

/**
 * Creates a new RDFLibGraph wrapping a provided `Dataset` or creating
 * a new one if no dataset is provided
 * @param store rdfjs Dataset object
 * @constructor
 */
var RDFLibGraph = function (store) {
  if (store != null) {
    this.store = store
  } else {
    this.store = rdf.dataset()
  }
}

RDFLibGraph.prototype.find = function (s, p, o) {
  return new RDFLibGraphIterator(this.store, s, p, o)
}

RDFLibGraph.prototype.query = function () {
  return RDFQuery(this)
}

RDFLibGraph.prototype.loadGraph = function (graphURI, rdfModel) {
  postProcessGraph(this.store, graphURI, rdfModel)
}

RDFLibGraph.prototype.clear = function () {
  this.store = rdf.dataset()
}

var RDFLibGraphIterator = function (store, s, p, o) {
  this.index = 0
  // TODO: Could probably make a lazy iterator since Dataset is already an iterator
  this.ss = store.match(s, p, o).toArray()
}

RDFLibGraphIterator.prototype.close = function () {
  // Do nothing
}

RDFLibGraphIterator.prototype.next = function () {
  if (this.index >= this.ss.length) {
    return null
  } else {
    return this.ss[this.index++]
  }
}

function ensureBlankId (component) {
  if (component.termType === 'BlankNode') {
    if (typeof (component.value) !== 'string') {
      component.value = '_:' + component.id
    }
    return component
  }

  return component
}

function postProcessGraph (store, graphURI, newStore) {
  var ss = newStore.match(undefined, undefined, undefined)
  for (const quad of ss) {
    var object = quad.object
    ensureBlankId(quad.subject)
    ensureBlankId(quad.predicate)
    ensureBlankId(quad.object)
    if (T('xsd:boolean').equals(object.datatype)) {
      if (object.value === '0' || object.value === 'false') {
        store.add(rdf.quad(quad.subject, quad.predicate, T('false'), graphURI))
      } else if (object.value === '1' || object.value === 'true') {
        store.add(rdf.quad(quad.subject, quad.predicate, T('true'), graphURI))
      } else {
        store.add(rdf.quad(quad.subject, quad.predicate, object, graphURI))
      }
    } else if (object.termType === 'collection') {
      var items = object.elements
      store.add(rdf.quad(quad.subject, quad.predicate, createRDFListNode(store, items, 0)))
    } else {
      store.add(rdf.quad(quad.subject, quad.predicate, quad.object, graphURI))
    }
  }

  for (var prefix in newStore.namespaces) {
    var ns = newStore.namespaces[prefix]
    store.namespaces[prefix] = ns
  }
}

function createRDFListNode (store, items, index) {
  if (index >= items.length) {
    return T('rdf:nil')
  } else {
    var bnode = TermFactory.blankNode()
    store.add(rdf.quad(bnode, T('rdf:first'), items[index]))
    store.add(rdf.quad(bnode, T('rdf:rest'), createRDFListNode(store, items, index + 1)))
    return bnode
  }
};

module.exports.RDFLibGraph = RDFLibGraph
module.exports.RDFLibGraphIterator = RDFLibGraphIterator
