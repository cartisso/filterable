/*!
 * Copyright 2014 WebScripts
 * Released under the MIT license (http://choosealicense.com/licenses/mit/)
 */
 
 //Utility
if (typeof Object.create !== "function") {
	Object.create = function (obj) {
		function F () {};
		F.prototype = obj;
		return new F();
	};
}

//Plugin
(function ($, window, document, undefined) {
	
	var options = {
		widthMin: 20							//minimum input width
		,widthMax: 0							//maximum input width
		,width: 0							//fixed input width - overrides widthMin and widthMax
		,enableRegex: false						//toggles RegEx filtering
		,enableCompare: false						//toggles value/date compare
		,delay: 500							//delay before filtering happens (0 - instant)
		,jqueryUi: true							//toggles jQueryUi for icon tooltips
		,inputClass: ""							//class applied to input fields
		,placeholder: "Filter"						//input's placeholder
		,dateFormats: ['dd/mm/yyyy', 'dd-mm-yyyy', 'yyyy-dd-mm', 'yyyy/dd/mm'] //date formats for date compare
		,rangeSeparator: ";"						//separates value/date ranges
		,beforeFilter: function () {}					//event
		,afterFilter: function () {}					//event
		,beforeCreate: function () {}					//event
		,afterCreate: function () {}					//event
		,beforeDestroy: function () {}					//event
		,afterDestroy: function () {}					//event
	};
		
	var filterableConstruct = {
		init: function (el, options) {
			this.el = el;
			this.$el = $(el);
			this.$header = this.getHeader();			
			this.options = {};			
			this.callback;
			this.methodToCall;
			this.instance;
			this.timeout;
			this.sizes = {};
			var self = this;
			
			this.setOptions(options);		
			
			this.setInstance();
			
			$('<style>').text(
				'.filteredOut { display: none }'
				+ 'div.filterablePlugin-button {background: #FF9C00;}'
				+ 'div.filterablePlugin-active {background: #4A9B17;}'				
			).appendTo('head');
		
			if (this.isNewInstanceRequest(options)) {				
				this.bindEvents();
			} else if (this.isValidMethod()) {
				this[this.methodToCall]();
			}
			this.executeCallback('afterCreate');		
		},
		bindEvents: function () {
			var self = this;
			$("input", this.instance).bind('keyup', function () {
				if (!self.options.delay) {
					return self.filterData();
				}
				clearTimeout(self.timeout);
				self.timeout = setTimeout(function () {
					return self.filterData();
				}, self.options.delay);					
			});
			this.$el.bind("update", function () {
				//TODO update
			})
		},
		getFilters: function () {
			var filters = {};
			$("input", this.instance).each(function () {
				var $input = $(this);
				var value = $input.val();
				var index = $input.closest("th, td").index();				
				if (!value) {
					return;
				}
				filters[index] = {
					value: value
					,type: "none"
				}
				var $th = $input.closest("td, th");
				var index = $th.index();
				var regexAttr = $th.attr("data-filterableplugin-regex");
				var compareAttr = $th.attr("data-filterableplugin-compare");
				if (typeof regexAttr !== "undefined" && regexAttr == "true") {
					filters[index].type = "regex";
				}
				if (typeof compareAttr !== "undefined" && compareAttr == "true") {
					filters[index].type = "compare";
				}
				
			});
			return filters;
		},
		__getFilters: function () {
			return this.getFilters;
		},
		executeCallback: function (functionName) {
			if (this.options[functionName] && typeof this.options[functionName] == "function") {
				this.options[functionName](this);
			}
		},
		filterData: function () {
			this.executeCallback('beforeFilter');
			var self = this;
			var filters = this.getFilters();
			var rows = this.getBodyRows();
			rows.removeClass("filteredOut");
			for (var i in filters) {
				if (!filters[i]) {
					continue;
				}
				var filter = this.getFilter(filters[i]);				
				var condition = self.getCondition(filter);
				rows.each(function () {					
					var $cell = $("td", $(this)).eq(i);
					var text = $cell.text();					
					if (!condition(text, filter)) {
						$(this).addClass("filteredOut");
					}
				});
			}			
			this.executeCallback('afterFilter');
		},
		getFilter: function (filter) {			
			if (filter.type == "regex") {
				var regexpr;
				try { 
				    filter.value = new RegExp(filter.value, "i");
				    return filter;
				   
				} catch(e) {return false}				
			}
			
			if (filter.type == "compare") {	
				var matches = filter.value.match(/^<>|^>=|^<=|^>|^<|^==|^=|^\!=|^\!/);
				if (matches && matches.length > 0) {
					var match = matches[0];
					filter.value = filter.value.replace(match, "");	
					date = this.parseDate(filter.value);	
					if (date) {
						filter.value = date;
						filter.isDate = true;											
					} else {
						filter.value = parseFloat(filter.value);	
					}
					filter.operator = match;
					return filter;
				}
				var range = filter.value.split(this.options.rangeSeparator);	
				if (range.length == 2) {
					var min = range[0];
					var max = range[1];
					var minDate = this.parseDate(min);
					var maxDate = this.parseDate(max);
					if (minDate && maxDate) {						
						filter.min = minDate;
						filter.max = maxDate;
						filter.isDate = true;					
					} else {
						filter.value = parseFloat(filter.value.toLowerCase().replace(match, ""));
						filter.min = parseFloat(min);
						filter.max = parseFloat(max);		
					}
					filter.operator = "-";
					
				}
			}
			return filter;
		},
		parseDate: function (str) {
			for (var i in this.options.dateFormats) {
				var format = this.options.dateFormats[i];
				var delim = format.replace(/[\w+ ]/g,"").slice(0,1);
				var dateParts = format.split(delim);
				var regex = [];
				for (var j in dateParts) {
					dateParts[j] = dateParts[j].replace(/[ ]/g, "");
					regex.push("[0-9]{" + dateParts[j].length + "}");
				}
				regex = "^" + regex.join(delim) + "$";
				var matched = str.match(regex);
				if (matched) {
					return new Date(str);
				}
			}
			
			return false;
		},
		getCondition: function (filter) {
			var self = this;
			var condition = function () {console.warn("Condition function is not set"); return true;};
			if (filter.type == "regex") {
				condition = function (filterText, filter) {
					return filterText.search(filter.value) != -1;
				};
			} else if (filter.type == "compare") {
				condition = function (filterText, filter) {
					filterText = filterText = filter.isDate ? new Date(filterText) : parseFloat(filterText);		
					return self.performCompare(filterText, filter);
				};
			} else {
				condition = function (filterText, filter) {
					filterText = filterText.toLowerCase();
					return filterText.indexOf(filter.value) != -1;
				};
			}			
			return condition;
		},
		performCompare: function (val1, filter) {
			switch (filter.operator) {
				case '!':
				case '!=':
				case '<>':
					return val1 != filter.value;
					break;
				case '>':
					return val1 > filter.value;
					break;
				case '>=':
					return val1 >= filter.value;
					break;
				case '<':
					return val1 < filter.value;
					break;
				case '<=':
					return val1 <= filter.value;
					break;
				case '=':
				case '==':
					return val1 == filter.value;
					break;
				case '-':
					return val1 >= filter.min && val1 <= filter.max
					break;
			}
		},
		addFilterInputs: function () {
			var instance = this.getFiltersHtml(); 
			this.$header.after(instance);
			return instance;
			
		},
		setSizes: function () {
			var self = this;
			$("th", this.$header).each(function () {
				var $th = $(this);
				var $input = $("input", $th);
				var thSpace = $th.width();
				self.sizes[$th.index()] = thSpace;
			});
		},
		getFiltersHtml: function () {
			var self = this;
			var row = $("<tr>")
							.attr({"class": "filterablePlugin"})
							.css({"text-align": "center"});
			$("th, td", this.$header).each(function () {
				var width = self.getInputWidth($(this));
				var th = $("<th>")
								.css({
									"text-align": "center"									
								});
				var input = $("<input>")
									.val("")
									.attr({
										"class": "filterableInput " + self.options.inputClass
										,"type": "text"
										,"placeholder": self.options.placeholder
									})									
									.css({
										width: width
									})
									.click(function () {
										$(this).select();
									});
				if (self.options.enableRegex === true) {
					var regexButton = self.getButtonHtml("regex");
				};				
				if (self.options.enableCompare === true) {
					var compareButton = self.getButtonHtml("compare");
				};
				var clear = $("<div>").css({"clear": "both"});
				var buttonWrapper = $("<div>")
										.append(regexButton)
										.append(compareButton)
										.append(clear)
										.css({
											position: "absolute"
											,right: 0
											,top: 0
											,"display": "inline-block"
										});
				
				var div = $("<div>")
								.append(input)
								.append(buttonWrapper)
								
								.css({
									position: "relative"
									,display: "inline-block"
								});
				
				
				th.append(div);
				row.append(th);
				if (self.options.jqueryUi) {
					$(".filterablePlugin-tooltip", row).tooltip();
				}				
			});
			return row;
		},
		getButtonHtml: function (type) {
			var self = this;
			var button = $("<div>")	
								.addClass("filterablePlugin-button")
								.addClass("filterablePlugin-tooltip")
								.css({
									"float": "right"
									,width: 25
									,height: 23 
									,"display": "inline-block"
									,"cursor": "pointer"
									,color: "#FFFFFF"
									,overflow: "hidden"
									,"text-shadow": "0 -1px 0 rgba(0, 0, 0, 0.25)"
									,"border-radius": "2px"
									,"line-height": "23px"
								});
			switch(type) {
				case "regex":
					button
						.html("(.*)")
						.attr({"title": "Use RegEx"})
						.click(function () {							
							self.toggleRegexClicked($(this));
						});
					break;
				case "compare":
					button
						.html(">=")
						.attr({"title": "Use Compare (=, >, <, >=, <=, <>, min;max), eg. >15, <>3000, 12;150"})
						.click(function () {
							self.toggleCompareClicked($(this));						
						});
					break;
				default:
					
					break;
			}
			return button;
			
		},
		toggleRegexClicked: function ($button) {
			if (this.options.enableRegex !== true) {
				return;
			}
			var th = $button.closest("th");
			$(".filterablePlugin-button", th).removeClass("filterablePlugin-active");
			th.attr({"data-filterableplugin-compare": "false"});
			var isActive = th.attr("data-filterableplugin-regex");
			if (typeof isActive !== 'undefined' && isActive == "true") {
				th.attr({"data-filterableplugin-regex": "false"});
			} else {
				th.attr({"data-filterableplugin-regex": "true"});
				$button.addClass("filterablePlugin-active");
			}
			$("input.filterableInput", th).select().focus();
			this.filterData();
		},
		toggleCompareClicked: function ($button) {
			if (this.options.enableCompare !== true) {
				return;
			}					
			var th = $button.closest("th");
			$(".filterablePlugin-button", th).removeClass("filterablePlugin-active");
			th.attr({"data-filterableplugin-regex": "false"});
			var isActive = th.attr("data-filterableplugin-compare");
			if (typeof isActive !== 'undefined' && isActive == "true") {
				th.attr({"data-filterableplugin-compare": "false"});
			} else {
				th.attr({"data-filterableplugin-compare": "true"});
				$button.addClass("filterablePlugin-active");
			}
			$("input.filterableInput", th).select().focus();
			this.filterData();
		},
		getInputWidth: function ($cell) {
			var leftPadding = parseInt($cell.css("padding-left"), 10);
			var rightPadding = parseInt($cell.css("padding-right"), 10);
			var index = $cell.index();
			var width = this.sizes[index];
			if (this.isFixedWidth()) {
				return this.options.width;
			}
			if (this.options.widthMax > 0) {
				return Math.min(width, this.options.widthMax);
			}			
			if (width <= this.options.widthMin) {
				return this.options.widthMin;
			}			
			return width;
		},
		isMaxWidth: function (width) {
			return this.options.widthMax > 0 && width >= this.options.widthMin;
		},
		isFixedWidth: function () {
			return this.options.width > 0;
		},
		getHeader: function () {
			if ($("thead", this.$el).length) {
				var tr = null;			
				$("thead tr", this.$el).each(function () {
					tr = $(this);					
				});
			} else {
				$("tr", this.$el).each(function () {
					trTmp = $(this);
					if ($("th", trTmp).length > 0) {
						tr = trTmp;
					}
				});
			}
			return tr;
		},
		getBodyRows: function () {
			var $header = this.getHeader();			
			var $thead = $header.closest("thead");
			var $next;		
			if ($thead.length) {
				var $next = $thead.next();
			} else {
				var $next = $header.next();
			}
			if ($next.is("tbody")) {
				return $next.children();
			} else {
				var index = $next.index();
				return $("tr", this.$el).slice(index, $("tr", this.$el).length);
			}
		},
		__destroy: function () {
			this.executeCallback('beforeDestroy');
			$("input", this.instance).unbind();
			this.$el.removeAttr("data-filterableplugin");
			$("tr", this.$el).show();
			this.instance.remove();
			this.executeCallback('afterDestroy');
		},
		setInstance: function () {
			var attr = this.$el.attr("data-filterableplugin");
			if (typeof attr !== "undefined" && attr) {
				this.instance = $("tr.filterablePlugin", this.$el);
				return;
			}			
			this.setSizes();
			this.executeCallback('beforeCreate');
			this.$el.attr({"data-filterableplugin": "true"});
			this.instance = this.addFilterInputs();
			this.setPostDisplaySizes();		
		},
		setPostDisplaySizes: function () {
			$("th", this.instance).each(function () {
				var $icons = $(".filterablePlugin-button", $(this));
				var $iconHolder = $icons.parent();
				var $input = $("input", $(this));							
				var leftPadding = parseInt($input.css("padding-left"));
				var rightPadding = parseInt($input.css("padding-right"));
				var topPadding = parseInt($input.css("padding-top"));
				var bottomPadding = parseInt($input.css("padding-bottom"));
				var leftBorder = parseInt($input.css("border-left"));
				var rightBorder = parseInt($input.css("border-right"));				
				leftPadding = isNaN(leftPadding) ? 0 : leftPadding;
				rightPadding = isNaN(rightPadding) ? 0 : rightPadding;
				topPadding = isNaN(topPadding) ? 0 : topPadding;
				bottomPadding = isNaN(bottomPadding) ? 0 : bottomPadding;
				leftBorder = isNaN(leftBorder) ? 0 : leftBorder;				
				rightBorder = isNaN(rightBorder) ? 0 : rightBorder;
				var top = Math.round((parseInt($(this).height()) - parseInt($input.height())) / 2) - topPadding;	
				$icons.width(parseInt($input.height()) + topPadding + bottomPadding);
				$icons.height(parseInt($input.height()) + topPadding + bottomPadding);
				$input.width(parseInt($input.width()) - leftPadding - leftBorder - rightPadding - rightBorder - 1);
				$iconHolder.css({top: top, right: 0});
			});
		},
		setOptions: function (options) {
			if (this.optionsPassed(options)) {
				return this.options = $.extend({}, $.fn.filterable.options, options);
			} else if (this.methodPassed(options)) {
				this.options = $.fn.filterable.options;
				this.methodToCall = "__" + options;				
			}
			this.options = $.fn.filterable.options;
		},
		isValidMethod: function () {
			if (typeof this[this.methodToCall] === "undefined") {
				console.warn("Filterable has no method '" + this.methodToCall.replace("__","") + "'");
				return false;
			}
			return true;
		},
		isNewInstanceRequest: function (options) {
			return this.optionsPassed(options) || typeof options === "undefined";
		},
		optionsPassed: function (options) {
			return typeof options === "object";
		},
		methodPassed: function (options) {
			return typeof options === "string";
		}
	};
	$.fn.filterable = function ( options ) {		
		return this.each(function () {			
			var filterableObject = Object.create(filterableConstruct);
			filterableObject.init(this, options);
		});
	};
	$.fn.filterable.options = options;
		
})(jQuery, window, document);
