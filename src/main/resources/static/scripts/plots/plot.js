
function Plot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  this.id = id.replace(/\./g,'');
  this.plotId = "plot_" + this.id;
  this.plotConfig = plotConfig;
  this.getDataFromServerFn = getDataFromServerFn;
  this.onFiltersChanged = onFiltersChangedFn;
  this.onPlotReady = onPlotReadyFn;
  this.isLoading = true;
  this.isVisible = true;
  this.isReady = true;
  this.isSwitched = false;
  this.cssClass = (cssClass != undefined) ? cssClass : "";
  this.switchable = (switchable != undefined) ? switchable : false;
  this.data = null;
  this.tracesCount = 0;
  this.addedTraces = 0;
  this.minX = 0;
  this.minY = 0;
  this.maxX = 0;
  this.maxY = 0;
  this.onHoverTimeout = null;

  this.$html = $('<div id="' + this.id + '" class="plotContainer ' + this.cssClass + '">' +
                  '<div class="loading">' +
                    '<div class="loadingGif"><img src="static/img/loading.gif"/></div>' +
                  '</div>' +
                  '<div id="' + this.plotId + '" class="plot"></div>' +
                  '<div class="plotTools">' +
                    '<button class="btn btn-default btnHidePlot"><i class="fa fa-eye-slash" aria-hidden="true"></i></button>' +
                    '<button class="btn btn-default btnFullScreen">' +
                      '<i class="fa ' + ((this.cssClass.startsWith("full")) ? 'fa-compress' : 'fa-arrows-alt') + '" aria-hidden="true"></i>' +
                    '</button>' +
                    '<button class="btn btn-default btnSave"><i class="fa fa-floppy-o" aria-hidden="true"></i></button>' +
                  '</div>' +
                  '<div class="hoverinfo"></div>' +
                '</div>');

 if (!isNull(toolbar)) {
   this.btnShow = $('<button class="btn btn-default btnShow ' + this.id + '"><i class="fa fa-eye" aria-hidden="true"></i></button>');
   this.btnShow.click(function(event){
      if (currentObj.btnShow.hasClass("plotHidden")) {
        currentObj.show();
      } else {
        currentObj.hide();
      }
   });
   var btnShowText = "";
   if (!isNull(this.plotConfig.styles.title)) {
     btnShowText = this.plotConfig.styles.title;
   }
   this.btnShow.html('<i class="fa fa-eye" aria-hidden="true"></i> ' + btnShowText);
   toolbar.find(".container").append(this.btnShow);

   this.btnHide = this.$html.find(".btnHidePlot");
   this.btnHide.click(function(event){
      currentObj.hide();
   });
 } else {
   this.$html.find(".btnHidePlot").remove();
 }

 this.btnFullScreen = this.$html.find(".btnFullScreen");
 this.btnSave = this.$html.find(".btnSave");
 this.plotElem = null;
 this.$hoverinfo = this.$html.find(".hoverinfo");

 this.show = function (){
   currentObj.isVisible = true;
   currentObj.$html.show();
   currentObj.btnShow.removeClass("plotHidden");
   currentObj.btnShow.find("i").switchClass( "fa-eye-slash", "fa-eye");
   currentObj.refreshData();
 }

 this.hide = function (){
   currentObj.isVisible = false;
   currentObj.$html.hide();
   currentObj.btnShow.addClass("plotHidden");
   currentObj.btnShow.find("i").switchClass( "fa-eye", "fa-eye-slash");
 }

 this.showLoading = function (){
   this.isLoading = true;
   this.$html.find(".loading").show();
 }

 this.hideLoading = function (){
   this.isLoading = false;
   this.$html.find(".loading").hide();
 }

 this.btnFullScreen.click(function( event ) {
   if (currentObj.$html.hasClass("fullWidth")) {
     currentObj.btnFullScreen.find("i").switchClass( "fa-compress", "fa-arrows-alt");
   } else {
     currentObj.btnFullScreen.find("i").switchClass( "fa-arrows-alt", "fa-compress");
   }
   currentObj.$html.toggleClass("fullWidth");
   currentObj.resize();
 });

 this.updateFullscreenBtn = function () {};
 this.updateFullscreenBtn();

 this.btnSave.click(function( event ) {
   var saveDialog = $('<div id="dialog_' + currentObj.id +  '" title="Save ' + currentObj.plotConfig.styles.title + '"></div>');
   saveDialog.dialog({
      buttons: {
        'Save as PNG': function() {
           currentObj.saveAsPNG();
           $(this).dialog('close');
           saveDialog.remove();
        },
        'Save as PDF': function() {
          currentObj.saveAsPDF();
           $(this).dialog('close');
           saveDialog.remove();
        },
        'Save as CSV': function() {
          currentObj.saveAsCSV();
           $(this).dialog('close');
           saveDialog.remove();
        }
      }
    });
    currentObj.$html.append(saveDialog);
 });

 if (switchable) {
   //If switchable adds Switch button to plot
   this.btnSwitch = $('<button class="btn btn-default btnSwitch"><i class="fa fa-retweet" aria-hidden="true"></i></button>');
   this.$html.find(".plotTools").append(this.btnSwitch);
   this.btnSwitch.click(function(event){
      currentObj.isSwitched = !currentObj.isSwitched;
      currentObj.refreshData();
   });
 }

 if (!isNull(this.plotConfig.styles.selectable) && this.plotConfig.styles.selectable) {
   //If plot is lightcurve adds Select button to plot
   this.btnSelect = $('<button class="btn btn-default btnSelect"><i class="fa fa-thumb-tack" aria-hidden="true"></i></button>');
   this.$html.find(".plotTools").append(this.btnSelect);
   this.btnSelect.click(function(event){
     currentObj.$html.toggleClass("plotSelected");
     OnPlotSelected();
   });
 }

 this.onDatasetValuesChanged = function ( filters ) {

   if (!isNull(this.parentPlotId)) {
     var tab = getTabForSelector(this.id);
     var parentPlot = tab.outputPanel.getPlotById(this.parentPlotId);
     parentPlot.applyValidFilters(filters);
   }

   this.applyValidFilters(filters);

    if (this.isVisible) {
       this.refreshData();
    }
 };

 this.refreshData = function () {
   this.setReadyState(false);

   if (isNull(this.getDataFromServerFn)) {
     if (!isNull(this.parentPlotId)) {
       var tab = getTabForSelector(this.id);
       var parentPlot = tab.outputPanel.getPlotById(this.parentPlotId);
       if (!parentPlot.isVisible) {
          log("Force parent plot to refresh data, Plot: " + this.id+ " , ParentPlot: " + parentPlot.id);
          parentPlot.refreshData();
          return;
       } else if (parentPlot.isReady) {
          this.setReadyState(true);
       }
     }

     log("Avoid request data, no service function setted, Plot" + this.id);
     return;
   }

   this.updatePlotConfig();
   this.getDataFromServerFn( this.plotConfig, this.onPlotDataReceived );
 }

 this.updatePlotConfig = function () {
   var tab = getTabForSelector(this.id);
   this.plotConfig.dt = tab.projectConfig.binSize;
 }

 this.onPlotDataReceived = function ( data ) {
   log("onPlotDataReceived passed data!, plot" + currentObj.id);
   data = JSON.parse(data);

   if (data != null) {
     currentObj.setData(data);
   } else {
     currentObj.showWarn("Wrong data received");
     log("onPlotDataReceived wrong data!, plot" + currentObj.id);
     currentObj.setReadyState(true);
     currentObj.onPlotReady();
   }
 }

 this.setData = function ( data ) {

   currentObj.showWarn("");

   if (isNull(data)) {

     currentObj.showWarn("Wrong data received");
     log("setData wrong passed data!, plot" + currentObj.id);

   } else {

     currentObj.data = currentObj.prepareData(data);
     currentObj.updateMinMaxCoords();

     var plotlyConfig = currentObj.getPlotlyConfig(data);
     currentObj.redrawPlot(plotlyConfig);

     if (currentObj.data.length == 0 || currentObj.data[0].values.length == 0){
       currentObj.showWarn("Empty plot data");
     }

   }

   currentObj.setReadyState(true);
   currentObj.onPlotReady();
 }

 this.prepareData = function (data) {
   return data; //This method is just for being overriden if necessary
 }

 this.getPlotlyConfig = function (data) {
   var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );
   var plotlyConfig = null;

   if (currentObj.plotConfig.styles.type == "2d") {
      plotlyConfig = get_plotdiv_xy(data[coords.x].values, data[coords.y].values,
                                    data[coords.x].error_values, data[coords.y].error_values,
                                    (data.length > 3) ? currentObj.getWtiRangesFromGtis(data[2].values, data[3].values, data[0].values) : [],
                                    currentObj.getLabel(coords.x),
                                    currentObj.getLabel(coords.y),
                                    currentObj.plotConfig.styles.title)

   } else if (currentObj.plotConfig.styles.type == "3d") {
      plotlyConfig = get_plotdiv_xyz(data[coords.x].values, data[coords.y].values, data[2].values,
                                    data[coords.x].error_values, data[coords.y].error_values, data[2].error_values,
                                    currentObj.getLabel(coords.x),
                                    currentObj.getLabel(coords.y),
                                    data[3].values);

   } else if (currentObj.plotConfig.styles.type == "scatter") {
      plotlyConfig = get_plotdiv_scatter(data[coords.x].values, data[coords.y].values,
                                        currentObj.getLabel(coords.x),
                                        currentObj.getLabel(coords.y),
                                        currentObj.plotConfig.styles.title);

   } else if (currentObj.plotConfig.styles.type == "scatter_colored") {
      plotlyConfig = get_plotdiv_scatter_colored(data[coords.x].values, data[coords.y].values, data[2].values,
                                        currentObj.getLabel(coords.x),
                                        currentObj.getLabel(coords.y),
                                        'Amplitude<br>Map',
                                        currentObj.plotConfig.styles.title);

   } else if (currentObj.plotConfig.styles.type == "colors_ligthcurve") {
      plotlyConfig = get_plotdiv_xyy(data[0].values, data[1].values, data[2].values,
                                   [], [], [],
                                   (data.length > 4) ? currentObj.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                   currentObj.getLabel(coords.x),
                                   currentObj.getLabel(coords.y),
                                   currentObj.getLabel(2),
                                   currentObj.plotConfig.styles.title);
   }

   plotlyConfig = currentObj.prepareAxis(plotlyConfig);

   return plotlyConfig;
 }

 this.prepareAxis = function (plotlyConfig) {
   if (currentObj.plotConfig.xAxisType == "log") {
     plotlyConfig.layout.xaxis.type = 'log';
     plotlyConfig.layout.xaxis.autorange = true;
   }

   if (currentObj.plotConfig.yAxisType == "log") {
     plotlyConfig.layout.yaxis.type = 'log';
     plotlyConfig.layout.yaxis.autorange = true;
   }

   return plotlyConfig;
 }

 this.redrawPlot = function (plotlyConfig) {
   try {
     if (plotlyConfig != null) {
       Plotly.newPlot(this.plotId, plotlyConfig.data, plotlyConfig.layout);
       this.plotElem = this.$html.find(".plot")[0];
       this.tracesCount = plotlyConfig.data.length;
       this.registerPlotEvents()
       this.resize();

     } else {
       this.showWarn("Wrong plot config");
       log("setData ERROR: WRONG PLOT CONFIG! plot " + this.id);
     }
   } catch (e) {
     this.showWarn("Wrong plot config");
     log("setData ERROR: WRONG PLOT CONFIG! plot " + this.id + ", exception:" + e);
   }
 }

 this.setReadyState = function (isReady) {
   this.isReady = isReady;
   if (!isReady) {
     this.showLoading();
   } else {
     this.hideLoading();
   }
 }

 this.resize = function () {
   try {
     if (this.plotElem != null) {
       var update = {
         width: $(this.plotElem).width(),
         height: $(this.plotElem).height()
       };

       Plotly.relayout(this.plotId, update);
     }
   } catch (ex) {
     log("Resize plot " + this.id + " error: " + ex);
   }
 }

 this.registerPlotEvents = function () {

   if((this.plotConfig.styles.type == "2d")
      || (this.plotConfig.styles.type == "ligthcurve")
      || (this.plotConfig.styles.type == "colors_ligthcurve")) {

     this.plotElem.on('plotly_selected', (eventData) => {

       if (eventData){
         var xRange = eventData.range.x;
         var yRange = eventData.range.y;
         var filters = [];

         //If plot data for label[0] is the same as axis[0] data,
         // else label data is calculated/derived with some process
         if (this.plotConfig.styles.labels[0].startsWith(this.plotConfig.axis[0].column)){
          filters.push($.extend({ from: fixedPrecision(xRange[0], 3), to: fixedPrecision(xRange[1], 3) },
                                  this.plotConfig.axis[0]));
         }

         //Same here but for other axis
         if (this.plotConfig.styles.labels[1].startsWith(this.plotConfig.axis[1].column)){
            filters.push($.extend({ from: fixedPrecision(yRange[0], 3), to: fixedPrecision(yRange[1], 3) },
                                  this.plotConfig.axis[1]));
         }

         if (filters.length > 0){
           currentObj.onFiltersChanged (filters);
         }
      }

      })
    }

    this.plotElem.on('plotly_hover', function(data){

      if (currentObj.onHoverTimeout != null) { clearTimeout(currentObj.onHoverTimeout); }

      currentObj.onHoverTimeout = setTimeout(function(){
        var coords = currentObj.getCoordsFromPlotlyHoverEvent(data);
        if (coords != null){
          currentObj.onHover(coords);

          var evt_data = currentObj.getSwitchedCoords({ x: coords.x, y: coords.y });
          evt_data.labels = currentObj.plotConfig.styles.labels;
          currentObj.sendPlotEvent('on_hover', evt_data);
        }
      }, 300);

    }).on('plotly_unhover', function(data){
      if (currentObj.onHoverTimeout != null) { clearTimeout(currentObj.onHoverTimeout); }
      currentObj.onUnHover();
      currentObj.sendPlotEvent('on_unhover', {});
    });
  }

  this.getPlotDefaultTracesCount = function (){
      return 1;
  }

  this.getCoordsFromPlotlyHoverEvent = function (data){
   if (data.points.length == 1) {
     var pt = data.points[0];
     if (this.tracesCount == this.getPlotDefaultTracesCount() || !isNull(pt.data.name)){ //Avoid to resend onHover over added cross traces
       var error_x = null;
       if (!isNull(pt.data.error_x)
          && !isNull(pt.data.error_x.array)
          && pt.pointNumber < pt.data.error_x.array.length) {
         error_x = pt.data.error_x.array[pt.pointNumber];
       }
       var error_y = null;
       if (!isNull(pt.data.error_y)
          && !isNull(pt.data.error_y.array)
          && pt.pointNumber < pt.data.error_y.array.length) {
         error_y = pt.data.error_y.array[pt.pointNumber];
       }
       return { x: pt.x, y: pt.y, error_x: error_x, error_y: error_y, label: pt.data.name };
     }
   }
   return null;
  }

  this.getNearestCoordsFromEvent = function (evt_data){
    var coords = this.getSwitchedCoords( { x: 0, y: 1} );

    if (this.data != null && this.plotConfig.styles.labels[coords.x].startsWith(evt_data.labels[0])) {
      var x = closest(this.data[coords.x].values, evt_data.x);
      var idx = this.data[coords.x].values.indexOf(x);
      var y = this.data[coords.y].values[idx];

      return { x: x, y: y, error_x: null, error_y: null };
    }

    return null;
  }

  this.updateMinMaxCoords = function (){
    if (this.data != null) {
      var coords = this.getSwitchedCoords( { x: 0, y: 1} );
      this.minX = Math.min.apply(null, this.data[coords.x].values);
      this.minY = Math.min.apply(null, this.data[coords.y].values);
      this.maxX = Math.max.apply(null, this.data[coords.x].values);
      this.maxY = Math.max.apply(null, this.data[coords.y].values);
    }
  }

  this.getSwitchedCoords = function (coords) {
    if (this.isSwitched){
      var x = coords.x;
      coords.x = coords.y;
      coords.y = x;
    }
    return coords;
  }

  this.onHover = function (coords){
   if (coords != null) {
     this.setLegendText( this.getLegendTextForPoint(coords) );
     this.showCross(coords.x, coords.y);
   }
  }

  this.onUnHover = function (){
   this.setLegendText("");
   this.hideCrosses();
  }

  this.getLabel = function (axis) {
    return this.plotConfig.styles.labels[axis];
  }

  this.getLegendTextForPoint = function (coords) {
    try {
       if (coords == null) { return ""; }
       var swcoords = this.getSwitchedCoords( { x: 0, y: 1} );
       var labelY = !isNull(coords.label) ? coords.label : this.getLabel(swcoords.y);
       var infotextforx = this.getLabel(swcoords.x) + ': ' + (isNull(coords.x) ? "---" : coords.x.toFixed(3));
       var infotextfory = labelY + ': ' + (isNull(coords.y) ? "---" : coords.y.toFixed(3));
       var error_x_string = "";
       var error_y_string = "";
       if (!isNull(coords.error_x)) {
         error_x_string= " +/-" + coords.error_x.toFixed(3);
       }
       if (!isNull(coords.error_y)){
         error_y_string= " +/-" + coords.error_y.toFixed(3);
       }
       return infotextforx + error_x_string + '</br>' + infotextfory + error_y_string;
     } catch (ex) {
       log("getLegendTextForPoint plot " + this.id + " error: " + ex);
     }
  }

  this.setLegendText = function (text) {
   this.$hoverinfo.html(text);
  }

  this.showWarn = function (warnmsg) {
    this.$html.find(".plotTools").find(".btnWarn").remove();
    if (warnmsg != ""){
      this.btnWarn = $('<button class="btn btn-danger btnWarn ' + this.id + '"><div>' +
                         '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + warnmsg +
                        '</div></button>');
      if (warnmsg.length > 50) {
        this.btnWarn.addClass("bigWarnBtn");
      }
      this.$html.find(".plotTools").prepend(this.btnWarn);
    }
  }

  this.showCross = function (x, y){
   Plotly.addTraces(this.plotElem, getCrossLine ([x, x], [this.minY, this.maxY]));
   Plotly.addTraces(this.plotElem, getCrossLine ([this.minX, this.maxX], [y, y]));
   this.addedTraces += 2;
  }

  this.hideCrosses = function (){
   var newaddedTraces = this.addedTraces;
   for (i = this.addedTraces + this.tracesCount; i > this.tracesCount; i--) {
     try {
       Plotly.deleteTraces(currentObj.plotElem, i - 1);
       newaddedTraces --;
     } catch (e) {
       //log("deleteTraces: ERROR ex: " + e);
     }
   }
   this.addedTraces = newaddedTraces;
  }

  this.sendPlotEvent = function (evt_name, evt_data) {
    //Sends event to all plots inside the tab
    var tab = getTabForSelector(this.id);
    if (tab != null) {
      tab.broadcastEventToPlots(evt_name, evt_data, this.id);
    }
  }

  this.receivePlotEvent = function (evt_name, evt_data, senderId) {
   if (this.plotElem != null && this.isVisible && this.id != senderId) {
     switch (evt_name) {
          case 'on_hover':
              this.onHover(this.getNearestCoordsFromEvent(evt_data));
              break;
          case 'on_unhover':
              this.onUnHover();
              break;
          default:
              log("receivePlotEvent: Unhandled event: " + evt_name + ", Plot.id: " + this.id);
      }
   }
  }

  this.saveAsPNG = function () {

   html2canvas(this.plotElem, {
       onrendered: function(canvas) {
           theCanvas = canvas;
           // Convert and download as image
           Canvas2Image.saveAsPNG(canvas);
           // Clean up
           //document.body.removeChild(canvas);
       }
   });
  }

  this.saveAsPDF = function () {
    html2canvas(this.plotElem, {
        onrendered: function(canvas) {
          var imgData = canvas.toDataURL("image/jpeg", 1.0);
          var pdf = new jsPDF();

          pdf.addImage(imgData, 'JPEG', 0, 0);
          var download = document.getElementById('download');

          pdf.save(currentObj.plotConfig.styles.title + ".pdf");
        }
    });
  }

  this.saveAsCSV = function () {
    var data = currentObj.data;
    if (!isNull(data)){
      var csvContent = "data:text/csv;charset=utf-8,";
      data[0].values.forEach(function(values, index){
         var infoArray = [data[0].values[index], data[1].values[index]];
         if (data.length > 2 && (data[1].values.length == data[2].values.length)) {
           infoArray.push(data[2].values[index]); //Adds errors if available
         }
         dataString = Array.prototype.join.call(infoArray, ",");
         csvContent += index < data[0].values.length ? dataString + "\n" : dataString;
      });
      var encodedUri = encodeURI(csvContent);
      var link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", currentObj.plotConfig.styles.title + ".csv");
      link.click();
    }
  }

  this.applyValidFilters = function (filters) {

    var tab = getTabForSelector(this.id);
    if (tab != null) {

     if (isNull(this.plotConfig.mandatoryFilters)
          || this.plotConfig.mandatoryFilters.length == 0) {
        //If no mandatoryFilters just set the filters
        this.plotConfig.filters = filters;
        return;
      }

     //Sets only valid filters: Valid filters is a filter without source, or
     //filter specified on mandatoryFilters
     // This is done on two loops beacuse we want to respect the order of mandatoryFilters
     validFilters = [];

     //First append to valid filters the ones without source
     for (f in filters) {
       var filter = filters[f];
       if (!isNull(filter) && isNull(filter.source)) {
         validFilters.push(filter);
       }
     }

     //Then for each manadatory filter finds the one with that source
     for (mf in this.plotConfig.mandatoryFilters) {
       var mfilter = this.plotConfig.mandatoryFilters[mf];
       if (!isNull(mfilter)) {
         for (f in filters) {
           var filter = filters[f];
           if (!isNull(filter)
              && !isNull(filter.source)
              && filter.source == mfilter.source
              && filter.table == mfilter.table
              && filter.column == mfilter.column) {
                if (!isNull(mfilter.replaceColumnInPlot) && mfilter.replaceColumnInPlot){
                  var replacedFilter = $.extend(true, {}, filter);
                  replacedFilter.column = tab.getReplaceColumn();
                  delete replacedFilter.source;
                  validFilters.push(replacedFilter);
                } else {
                  validFilters.push(filter);
                }
              }
          }
        }
     }

     this.plotConfig.filters = validFilters;
   }
  }

  this.getWtiRangesFromGtis = function (gti_start, gti_stop, timevals) {

   //Prepares Wrong Time Intervals for background highlight
   var wti_ranges = [];

   if (!isNull(gti_start) && !isNull(gti_stop) && !isNull(timevals)
      && timevals.length > 0
      && gti_start.length > 0
      && gti_stop.length > 0
      && gti_start.length == gti_stop.length) {

      //var last = -1;
      for (i in gti_start){
        if (i > 0) {
          if (gti_stop[i - 1] < gti_start[i]) {
            wti_ranges.push([gti_stop[i - 1], gti_start[i]]);
          }
          //last = gti_stop[i];
        } /*else if (gti_start[0] > timevals[0]) {
            //This adds WTI range before first event
            wti_ranges.push([timevals[0], gti_start[0]]);
        }*/
      }

      /* This adds WTI range after last event
      if (last > timevals[timevals.length -1]) {
        wti_ranges.push([timevals[timevals.length -1], last]);
      }*/
   }

   return wti_ranges;
  }

  /*
  // detectWtiRangesFromData IS NOT USED, JUST KEEPED FOR POSIBLE FURTHER USE
  this.detectWtiRangesFromData = function (data) {

   //Prepares Wrong Time Intervals for background highlight

   if (data[0].values.length == 0) {
      return [];
   }

   var wti_x_ranges = [];
   var last_x = data[0].values[data[0].values.length - 1];
   var x = data[0].values[0];
   var totalElapsed = last_x - x;
   var prevX = x - 1;
   var prevY = 0;
   var prevPrevX = x - 2;
   var trigger_ratio = 10;  // The ratio of elapsed time versus prev elapsed for triggering a gap
   var elapsed_avg = 0;

   for (i in data[0].values) {

       x = data[0].values[i];
       y = data[1].values[i];
       var elapsed = x - prevX;

       if (y > 0){
         if (elapsed_avg > 0) {
           var ratio = elapsed / elapsed_avg;

           if (prevX > prevPrevX && prevPrevX > 0 && elapsed_avg != 1) {
             if (ratio > trigger_ratio) {
               //Looks that we are outside a GTI
               //Sets range start to end, x is the end index of the gti
               var wtiStart = prevX + (prevX - prevPrevX)/2;
               var wtiStop = x - (prevX - prevPrevX)/2;
               if (totalElapsed / (wtiStop - wtiStart) < trigger_ratio) {
                 // If WTI is at least the tenth part of total time
                 wti_x_ranges.push([wtiStart, wtiStop]);
               }
             }
           }

           // Calulates the ne elapsed_avg with the latest 5 vals, avoid break avg with gaps
           if (ratio < trigger_ratio || elapsed_avg == 1) {
             elapsed_avg += (elapsed - elapsed_avg) * 0.2;
           }

         } else {
           elapsed_avg = elapsed;
         }

         prevPrevX = prevX;
         prevX = x;
       }

       prevY = y;
   }

   return wti_x_ranges;
  }// --END detectWtiRangesFromData IS NOT USED, JUST KEEPED FOR POSIBLE FURTHER USE
  */

  log ("new plot id: " + this.id);

  return this;
}

//Static plot METHODS
function OnPlotSelected () {

  var $selectedPlots = $(".plotSelected");
  if ($selectedPlots.length > 1){

    log("OnPlotSelected: Multiple plots selected!");
    var selectedPlots = [];

    //For each plot element find its plot object in all tabs outputpanels
    $selectedPlots.each(function(){
      var tab = getTabForSelector(this.id);
      if (tab != null) {
        var plot = tab.outputPanel.getPlotById(this.id);
        if (plot != null) {
          log("OnPlotSelected: Got plot id: " + this.id);
          selectedPlots.push(plot);
        }
      }
    })

    if (selectedPlots.length > 1) {
      onMultiplePlotsSelected(selectedPlots); // master_page.js method
    }
  }
}

function ClearSelectedPlots () {
  $(".plotSelected").removeClass("plotSelected");
}
