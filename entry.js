/*
 * Copyright (c) 2019 Instrumentation Technologies
 * All Rights Reserved.
 *
 * $$Id: $$
 */

// from https://stackoverflow.com/a/47759612
// make sure this is inatatieted before other vue component
// Vue.prototype.$vueEventBus = new Vue();

makeLiberaApplicationNamePretty = function(textFromElement) {
  var temp = textFromElement.replace('libera-','');
  var r = temp.toString().replace(/-/g, " ");
  return r;
};

var ITECH = {};

ITECH.callGlobalByName = function(functionName, ...args) {
  // modified from
  // https://stackoverflow.com/questions/359788/how-to-execute-a-javascript-function-when-i-have-its-name-as-a-string
  var namespaces = functionName.split(".");
  var func = namespaces.pop();
  var context = window; // global
  for (var i = 0; i < namespaces.length; i++) {
    context = context[namespaces[i]];
  }
  return context[func].apply(null, args);
};

ITECH.uriParams = function() {
  let uri = window.location.search.substring(1);
  return new URLSearchParams(uri);
};

// https://en.wikipedia.org/wiki/Identity_function
ITECH.identity = function(x) { return x; };

ITECH.apiPath = "/api";

ITECH.putJSON = function(url, data, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.responseType = 'json';
  xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  xhr.send(JSON.stringify(data));
  xhr.onload = function() {
    var status = xhr.status;
    callback(status, xhr.response);
  };
  return xhr;
};

ITECH.getNode = function(path, callback /* void(status,response) */) {
  var req = {};
  req["path"] = path;
  req["cmd"] = "get";
  return ITECH.putJSON(ITECH.apiPath, req, callback)
};

ITECH.setNode = function(path, value, callback /* void(status,response) */) {
  var req = {};
  req["path"] = path;
  req["cmd"] = "set";
  req["value"] = value;
  return ITECH.putJSON(ITECH.apiPath, req, callback)
};

ITECH.getInfo = function(path, callback /* void(status,response) */) {
  var req = {};
  req["path"] = path;
  req["cmd"] = "info";
  return ITECH.putJSON(ITECH.apiPath, req, callback)
};

ITECH.node = {
  props : {
    "path" : String,
    "name" : String,
    "poolingPeriod" : {
      type : Number,
      default : 100000,
    },
    "makeTextPretty" : {
      type : Boolean,
      default : false,
    },
    // onSet can be set as global function that receive input value and
    // reference to node object (this)
    "onSet" : String
  },
  data : function() { //
    return {
      //
      poolingTimer : null,
      //
      inputOpen : false,
      inputEntry : "",
      inputError : null,
      //
      xhr : null,
      selectOptions : []
    };
  },
  methods : {
    fetchNode : function() {
      this.xhr = ITECH.getNode(this.path, function(status, rsp) {
        this.xhr = null;
        if (status == 200) {
          // apply  modifier
          var val = this.defaultMap(this.fromResponseValue(rsp.value));

          // call by name if set from user
          if (this.onSet) {
            val = ITECH.callGlobalByName(this.onSet, val, this);
          }
          this.value = val;
        }
        this._shedulePooling();
        // else TODO handle errors
      }.bind(this));
    },
    fromResponseValue : function(val) { return val.toString(); },
    // private
    _shedulePooling : function() {
      if (this.poolingPeriod > 0) {
        // make sure we run single timer
        if (this.poolingTimer) {
          clearTimeout(this.poolingTimer);
        }
        this.poolingTimer = setTimeout(this.fetchNode, this.poolingPeriod);
      }
    },
    defaultMap : ITECH.identity
  },
  beforeDestroy : function() {
    if (this.poolingTimer) {
      clearTimeout(this.poolingTimer);
      this.poolingTimer = null;
    }
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }
  },
  mounted : function() { this.fetchNode(); },
  template : "#node-super-template"
};

ITECH.type2html = {
  "Undefined" : {},
  "Bool" : {},
  "Long" : "number",
  "ULong" : "number",
  "LongLong" : "number",
  "ULongLong" : "number",
  "Double" : "number",
  "Float" : "number",
  "String" : "text",
  "Enumeration" : "text"
};

ITECH.nodeInfo = {
  methods : {
    fetchInfo : function() {
      ITECH.getInfo(this.path, function(status, rsp) {
        if (status == 200) {
          this.setError = null;
          this.info = rsp;
        } else {
          this.setError = rsp.error || "error";
          console.log(this.setError)
        }
      }.bind(this));
    },
  },
  data : function() {
    return {
      //
      info : {},
      type : "Undefined",
      error : false,
    };
  },
  watch : {
    info : function(val) { //
      this.type = this.info.value.type;
    }
  },
  computed : {typeHtml : function() { return ITECH.type2html[this.type]; }},
  mounted : function() { //
    this.fetchInfo();
  }
};

ITECH.nodeGet = Vue.extend({
  mixins : [ ITECH.node, ITECH.nodeInfo ],
  data : function() {
    return {
      //
      value : "...",
      template : "get"
    };
  },
  // template : `#node-get-template`
});
Vue.component('node', ITECH.nodeGet);

ITECH.nodeSet = {
  props : {
    // onSet can be set as global function that receive input value and
    // reference to node object (this)
    "onSet" : String
  },
  data : function() { return {template : "setget", xhrset : null}; },
  methods : {
    submitForm : function() {
        return this.setValue(this.inputEntry); 
      },
    setValue : function(val) {
      // apply  modifier
      var val = this.defaultMap(val);
      // call by name if set from user
      if (this.onSet) {
        val = ITECH.callGlobalByName(this.onSet, val, this);
      }
      this.xhrset = ITECH.setNode(this.path, val, function(status, rsp) {
        this.xhrset = null;
        if (status == 200) {
          this.fetchNode();
          this.inputOpen = false;
          this.inputError = null;
        } else {
          this.inputError = rsp.error;
          console.log(rsp.error)
        }
        // else TODO handle errors
      }.bind(this));
    },
    defaultMap : ITECH.identity,
    buttonClick : function() {
      this.inputOpen = !this.inputOpen;
      this.inputError = null;
    }
  },
  beforeDestroy : function() {
    if (this.xhrset) {
      this.xhrset.abort();
      this.xhrset = null;
    }
  },
};

ITECH.nodeSetExt = Vue.extend({
  mixins : [ ITECH.nodeGet, ITECH.nodeSet ],
});
Vue.component('node-set', ITECH.nodeSetExt);

ITECH.nodeSelect = Vue.extend({
  mixins : [ ITECH.nodeGet, ITECH.nodeSet ],
  props : {
    show_select_apply : Boolean,
    expose_as : Object,
    add_options : Object
  },

  data :
      function() { return {template : "select", show_select_apply : false}; },
  watch : {
    info : function(val) {
      var domains = this.info.value.domains;
      var op = [];
      for (i = 0; i < domains.length; ++i) {
        var v = domains[i];
        if (this.expose_as) {
          if (v in this.expose_as) {
            op.push({"name" : this.expose_as[v], "value" : v});
          }
        } else {
          op.push({"name" : v, "value" : v});
        }
      }
      if (this.add_options) {
        for (var i = 0; i < Object.keys(this.add_options).length; ++i) {
          var k = Object.keys(this.add_options)[i];
          var v = Object.values(this.add_options)[i];
          op.push({"name" : k, "value" : v});
        }
    }
      this.selectOptions = op;     
    }
  },
  methods : {
    applySelectedTrigger : function(ev) {
      this.setValue(this.$el.querySelector("#selectTriggerSource").value);
    }
  }
});
Vue.component('node-select', ITECH.nodeSelect);

ITECH.nodeToggle = Vue.extend({
  mixins : [ ITECH.nodeGet, ITECH.nodeSet ],
  data : function() { //
    return {
      template : "toggle",
    };
  },
  methods : {
    onClick : function(ev) { //
      this.setValue(ev.target.checked);
    },
    fromResponseValue : ITECH.identity,
  }
});
Vue.component('node-toggle', ITECH.nodeToggle);

ITECH.graph = {
  props : {
    "path" : String,
    "name" : String,
    "mode" : String,
    "poolingPeriod" : {
      type : Number,
      default : 200,
    }
  },
  data : function() { //
    return {
      //
      dygraph : null,
      styleObject : {
        // for style
        width : "100%",
        height : "auto",
      },
      styleObjectGraph : {
        //
        width : "100%", //"400px",
        // height : "400px",
      },
      labels : [ "a", "b", "c", "d", "e" ],
      graph_resize : true,
      components : [],
      checkedSignals : [],
      pausechart : false,
      xhrsig : null,
      signalReqSize : 100,
      graphSize : 100,
      clkIndex : 0,
      graphWidth : 1e6, // large number
      graphHeight : 1e6,
      dygraphOptions : {
        showRangeSelector : false,
        labelsKMB : true,
        digitsAfterDecimal : 6 
      },
      signalRxData : [],
      expectRedrawOnRx : true,
      autoDownload : false,
      autoDownloadStartIndex : 0,
    };
  },
  computed : {
    // we add props here, to enable us ovveride in other mixins
    path_ : function() { return this.path; },
    name_ : function() { return this.name; },
    mode_ : function() { return this.mode; },
    poolingPeriod_ : function() { return this.poolingPeriod; }
  },
  methods : {
    getInfo : function() {
      this.xhrsig = ITECH.putJSON( //
          ITECH.apiPath,
          {"cmd" : "get", "path" : this.path_ + ".components_names"},
          function(status, rsp) {
            this.xhrsig = null;
            if (status == 200) {
              this.components = rsp.value;
              this.checkedSignals = rsp.value;
              var labels = [ "x" ].concat(this.components);
              // var dummy_data = new Array(labels.length);
              // dummy_data = dummy_data.map(x => 0);
              // update components name
              this.dygraph.updateOptions({
                "labels" : labels,
                "file" : [ Array(labels.length-1).fill(0) ]
              });
              //
              this.onGetInfo();
            }
          }.bind(this));
    },
    onGetInfo : function() { this.fetchSignal(); },
    fetchSignal : function() {
      if (this.xhrsig) {
        this.xhrsig.abort();
        this.xhrsig = null;
      }
      if (this.poolingTimer) {
        clearTimeout(this.poolingTimer);
        this.poolingTimer = null;
      }
      var req = {
        "cmd" : "signal",
        "path" : this.path_,
        "size" : this.signalReqSize
      };
      if (this.mode_ !== null) {
        req["mode"] = this.mode_;
      }
      this.xhrsig = ITECH.putJSON(ITECH.apiPath, req, function(status, rsp) {
        this.xhrsig = null;
        if (status == 200) {
          this.onSignalReceived(rsp);
        }
        this._shedulePooling();
      }.bind(this))
    },
    initGraph : function() { //
      this.dygraph = new Dygraph(this.$el.querySelector("#graph"), [ [ 0 ] ], {
        legend : 'always',
        showRoller : false,
        title : "",
        labels : [ "x" ],
        axes : {y : {axisLabelWidth : 70}},
      });
      this.dygraphOptions.title = this.name_ || "graph";
      this.dygraphOptions.xlabel= 'index';
      this.dygraphOptions.ylabel= '[a.u.]';
      this.dygraphOptions.animatedZooms = true;

      this.dygraph.updateOptions(this.dygraphOptions);
      this.onClick();
      this.getInfo();
    },
    onWindowResize : function() {
      // when browser window become smaller than graph width
      var w = this.$el.clientWidth - 20;
      this.resizeGraph(w, this.graphHeight);
      // this does not work as expected (only when whole window is
      // resized) this.onClick();
    },
    onClick : function() {
      // todo figure out how to make dragging better
      var el = this.$el.querySelector("#resizeFrame");
      this.resizeGraph(this.$el.clientWidth - 20, el.offsetHeight);
    },
    onSignalReceived : function(rsp) {
      var d = ITECH.transpose(this.components, rsp, this.clkIndex);
      this.clkIndex += d.length;
      var graphSize = parseInt(this.graphSize);
      var remLen = Math.max(graphSize - d.length, 0);
      if (remLen > 0) {
        this.signalRxData = this.signalRxData.slice(0 - remLen).concat(d);
      } else {
        if (d.length <= this.graphSize) {
          this.signalRxData = d;
        } else {
          // in case user "want" on display less that rx data size
          this.signalRxData = d.slice(0, graphSize);
        }
      }
      if (this.autoDownload) {
        if (this.clkIndex >= Number(this.autoDownloadStartIndex) + Number(this.graphSize)) {
          this.autoDownload = false;
          this.downloadData();
        }
      }
      this.redrawGraph();
    },
    redrawGraph : function() {
      if (!this.pausechart) {
        var opt = {"file" : this.signalRxData};
        var xright = this.dygraph.xAxisRange()[1];
        if(this.signalRxData[0][0] > xright){
          // if index of first element is greater than right part of zoom
          // then reset zoom
          opt["dateWindow"] = null;
          opt["valueRange"] = null;
        }
        this.dygraph.updateOptions(opt);
      }
    },
    resizeGraph : function(w, h) {
      this.graphWidth = w;
      this.graphHeight = h;
      this.styleObject.width = w.toString() + "px";
      this.styleObject.height = h.toString() + "px";
      // todo improve this
      this.styleObjectGraph.width = (w - 10).toString() + "px";
      this.styleObjectGraph.height = (h - 10).toString() + "px";
    },
    clearGraph : function() {
      if (this.xhrsig) {
        this.xhrsig.abort();
        this.xhrsig = null;
      }
      if (this.poolingTimer) {
        clearTimeout(this.poolingTimer);
        this.poolingTimer = null;
      }
      this.signalRxData = [];
      this.dygraph.updateOptions({
        "file" : [ [ 0 ] ],
        "labels" : [ "x" ],
        "valueRange" : null, // unzoom
        "dateWindow" : null,
      });
      this.clkIndex = 0;
    },
    onNewSignalPath : function() {
      this.pausechart = false;
      this.clearGraph();
      this.getInfo();
    },
    downloadData : function() {
      // TODO make sure fname is valid
      var now = new Date();
      var isoString = now.toISOString();
      var fname = isoString.concat("_", this.selectedSig.name, ".csv");
      var ftype = "text/csv"; // https://tools.ietf.org/html/rfc7111
      // csv dummy way (should we add header?)
      var head = [ "x" ].concat(this.components).join(";");
      var d = head + "\n";
      for (var i = 0; i < this.signalRxData.length; ++i) {
        d += this.signalRxData[i].join(";") + "\n";
      }
      ITECH.userDownload(d, fname, ftype);
    },
    onClickAutoDownload : function(ev) {
      var value = ev.currentTarget.checked;
     if (value) {
        this.autoDownloadStartIndex =
            this.clkIndex; // hack(bug)  clock monotone only now
      }
    },
    clickPause : function(ev) {
      var paused = ev.currentTarget.checked;
      if (paused) {
        if (this.poolingTimer) {
          clearTimeout(this.poolingTimer);
          this.poolingTimer = null;
        }
      } else {
        this.fetchSignal();
      }
    },
    // private
    _shedulePooling : function() {
      if ((this.poolingPeriod >= 0) && (!this.pausechart)) {
        // make sure we run single timer
        if (this.poolingTimer) {
          clearTimeout(this.poolingTimer);
          this.poolingTimer = null;
        }
        this.poolingTimer = setTimeout(this.fetchSignal, this.poolingPeriod_);
      }
    },
  },
  watch : {
    styleObject : {
      handler : function(val) { //
        this.graph_resize = true;
      },
      deep : true
    },
    checkedSignals : function(checked) {
      var i = this.components.map(x => checked.includes(x));
      this.dygraph.updateOptions({"visibility" : i});
    },
    signalReqSize : function() { this.fetchSignal(); },
    graphSize : function() {
      if (this.graphSize < this.signalRxData.length) {
        this.signalRxData = this.signalRxData.slice(-1 * this.graphSize);
        this.redrawGraph();
      }
    },
    dygraphOptions : {
      handler : function(opt) {
        graph_data = this.signalRxData;
        zeroedData = [[0,0,0,0,0]];

        // this will clear the graph to remove the artefacts in the "range selector"
        this.dygraph.updateOptions(
        { 
            'file': zeroedData
        });

        // this handle any change on dygraphOptions update
        this.dygraph.updateOptions(opt);

        this.dygraphOptions.title = this.name_ || "graph";
        this.dygraph.updateOptions(this.dygraphOptions);
        
        this.graph_resize = true;

        // put the values back into the graph
        this.dygraph.updateOptions(
        { 
            'file': graph_data
        });

        delete graph_data;
      },
      deep : true
    },
    name_ : function(v) {
      // on new name reset zoom
      this.dygraph.updateOptions({"title" : this.name_});
    }
  },
  updated : function() {
    // make sure that dom props regarding size are set
    if (this.graph_resize) {
      this.dygraph.resize();
    }
    this.graph_resize = false;
  },
  mounted : function() {
    this.initGraph();
    window.addEventListener('resize',
                            function() { this.onWindowResize(); }.bind(this));
  },
  template : graph_template,
  beforeDestroy : function() {
    if (this.poolingTimer) {
      clearTimeout(this.poolingTimer);
      this.poolingTimer = null;
    }
    if (this.xhrsig) {
      this.xhrsig.abort();
      this.xhrig = null;
    }
  },
};

Vue.component('graph', ITECH.graph);

Vue.component('graph-current', {
  //
  mixins : [ ITECH.graph ],

  template : current_graph_template,
  data : function() {
    return {
      selectSigOptions : [
        {
          path : "application.signals.adc",
          name : "ADC raw",
          mode : "Event"
        },
        {
          path : "application.signals.adc_synth",
          name : "ADC synthetic",
          mode : "Event"
        },  
      ],
      selectedSig : {
        path : "application.signals.adc",
        name : "ADC raw",
        mode : "Event"
      }
    };
  },
  computed : {
    name_ : function() { //
      return this.selectedSig.name;
    },
    path_ : function() { //
      return this.selectedSig.path;
    },
    mode_ : function() { //
      return this.selectedSig.mode;
    }
  },
  watch : {selectedSig : function() { this.onNewSignalPath(); }}
});

Vue.component('quarter', {template : '#quarter-template', props : [ 'title' ]});

Vue.component('tablev', {template : '#table-template'});

function setNumberOfGraphsPerRow() {
  var elements = document.getElementsByClassName("itech-graph");

  for (var i = 0, item; item = elements[i]; i++) {
    item.classList.toggle("w3-half");
  }

  var element = document.getElementById("numberOfGraphsButton");

  if (element.innerHTML === "Set two graphs per row") {
    element.innerHTML = "Set one graph per row";
  } else {
    element.innerHTML = "Set two graphs per row";
  }

  window.dispatchEvent(new Event('resize'));
}

ITECH.readCurrentProcess = {
  data : function() {
    return {
      current : {
        a : "ADC counts",
        b : "nA",
        c : "uA",
        d : "mA",
      },
      xrhcur : null,
      poolingTimer : null,
      poolingPeriod : 250,
      path : "application.signals.sa"
    };
  },
  methods : {
    fetchSignal : function() {

      if (this.xhr) {
        this.xrh.abort();
        this.xrh = null;
      }
      if (this.poolingTimer) {
        clearTimeout(this.poolingTimer);
        this.poolingTimer = null;
      }

      var req = {"cmd" : "signal", "path" : this.path, "size" : 1};
      this.xrhcur = ITECH.putJSON(ITECH.apiPath, req, function(status, rsp) {
        this.xrhcur = null;
        if (status == 200) {
          var v = rsp.value;
          this.current.a = this.toPrettyCurrent(v.A[0]);
          this.current.b = this.toPrettyCurrent(v.B[0]);
          this.current.c = this.toPrettyCurrent(v.C[0]);
          this.current.d = this.toPrettyCurrent(v.D[0]);
        }
        this._shedulePooling();
      }.bind(this));
    },
    toPrettyCurrent : function(pA) {
      var pabs = Math.abs(pA);
      const toStr = x => x.toString().slice(0, 7);
      if (pabs < 1000) {
        return toStr(pA) + " ADC counts";
      }
      if (pabs < 1e6) {
        return toStr(pA * 1e-3) + " ADC counts";
      }
      if (pabs < 1e9) {
        return toStr(pA * 1e-6) + " ADC counts";
      }
      if (pabs < 1e12) {
        return toStr(pA * 1e-9) + " ADC counts";
      }
      return (pA * 1e-12).toString() + " ADC counts";
    },
    _shedulePooling : function() {
      if (this.poolingPeriod > 0) {
        if (this.poolingTimer) {
          clearTimeout(this.poolingTimer);
        }
        this.poolingTimer = setTimeout(this.fetchSignal, this.poolingPeriod);
      }
    }
  },
  created : function() { this.fetchSignal(); },
  beforeDestroy : function() {
    if (this.poolingTimer) {
      clearTimeout(this.poolingTimer);
      this.poolingTimer = null;
    }
    if (this.xhrcur) {
      this.xhrcur.abort();
      this.xhrcur = null;
    }
  },
};
Vue.component('current-proc', ITECH.readCurrentProcess);

ITECH.readCurrentProcPercetage = {
  mixins : [ ITECH.readCurrentProcess ],
  data : function() {
    return {
      path : "application.signals.sds",
      gainCompensationNodeSds: "application.range_ctrl.gain_compensation.sds",
      fullRange : 128 * 1024,
      gainCompensationValSds : null
    };
  },
  methods : {
    toPrettyCurrent : function(counts) {
      this.xrhcur = ITECH.getNode(this.gainCompensationNodeSds, function(status, rsp) {
        this.xrhcur = null;
        if (status == 200) {
          this.gainCompensationValSds = rsp.value.toString();
        }
      }.bind(this));
      
      if(this.gainCompensationValSds) {
        var percent = (100 * Math.abs(counts) / this.fullRange) * this.gainCompensationValSds;
        return percent.toFixed(1) + " %";
      }
    }
  }
};
Vue.component('current-proc-percent', ITECH.readCurrentProcPercetage);

ITECH.currentNoode = {
  props : [ 'name', 'valueeval' ],
  template : `<tr class="currentValueContainer">
               <td class="currentName"><font size="+1">{{name}}</font></td> 
               <td class="currentValue"><font size="+1"><b><div>{{value}}</div></b></font></td> 
             </tr>`,
  computed : {
    current : function() { //
      return this.$root.$refs.currentproc.current;
    },
    currentperc : function() { //
      return this.$root.$refs.currentprocperc.current;
    },
    value : function() {
      // TODO figure how to make without eval
      return eval(this.valueeval);
    }
  },
};
Vue.component('read-current', ITECH.currentNoode);

ITECH.app = {
  el : '#vueapp',
  data : function() {
    //
    return {side_menu_visible : true};
  },
  computed : {
    num_graphs : function() {
      var ng = ITECH.uriParams().get("num_graphs");
      return (ng !== null) ? parseInt(ng) : 1;
    }
  },
  methods : {
    onClickOpenSideMenu : function() { //
      this.side_menu_visible = !this.side_menu_visible;
    },
    onSlideMenuAnimEnd : function() {
      this.$nextTick(function() { window.dispatchEvent(new Event('resize')); });
    }
  }
};

ITECH.accordion = {
  template : '#accordion-container',
  props : [ 'title', 'button_class', 'panel_class' ],
  data() {
    return {
      template_panel_class : this.panel_class,
      template_button_class : this.button_class,
    };
  },
  methods : {
    enableSidebarAccordionEventListeners : function() {
      var elem = this.$el;
      elem.querySelector(".accordion").classList.toggle("active");

      var panel = elem.querySelector(".panel");
      var libera_ireg_nodes_exist =
          elem.querySelector(".sidebar_accordion_panel_show") !== null;

      panel.classList.toggle("sidebar_accordion_panel_show");
    },
    setActiveButton : function() {
      var elem = this.$el.querySelector(".libera_ireg_nodes_button");
      if (elem) {
        elem.classList.toggle("active");
      }
    }
  },
  mounted : function() { this.setActiveButton(); },
};

Vue.component('accordion-container', ITECH.accordion);

// transpose like function, that returns data
// apropriate for dygraph
// TODO - optimise performance (add support for consuming binary data from
// backend api)
// extra idea :  can we jsut hack view, so that access to elemets is
// "transposed"
ITECH.transpose = function(cmp, data, x0 = 0) {
  if (cmp.length == 0) {
    return [ 0 ]; // dygraph does not like to show empty data
  }
  var r = [];
  var val = data.value;
  var d = val[cmp[0]]; // first column used for sizing
  var dlen = d.length; // Math.min(10000,d.length); // TODO test only
  var r = Array(dlen);
  var alen = cmp.length + 1;
  for (j = 0; j < dlen; ++j) {
    var t = new Float64Array(alen);
    t[0] = j + x0;
    for (var i = 1; i < alen; ++i) {
      t[i] = val[cmp[i - 1]][j];
    }
    r[j] = t;
  }
  return r;
};

// provide data to user for download
// https://stackoverflow.com/a/30832210
ITECH.userDownload = function(data, filename, type) {
  var file = new Blob([ data ], {type : type});
  var a = document.createElement("a"), url = URL.createObjectURL(file);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
};

var vueApp = new Vue(ITECH.app);
