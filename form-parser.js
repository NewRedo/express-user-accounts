// Copyright (c) 2017 NewRedo Ltd.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
// THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

"use strict";

const Busboy = require("busboy");
const EventEmitter = require("events");
const moment = require("moment");
const extend = require("extend");

/*
constructor(fields);

fields
	An aray of field definitions.
*/
class FormParser extends EventEmitter {

	constructor(fields) {
		super();
		this._fields = fields;
	}

	parsePost(req, callback) {
	    if (req.body) {
	        this.parseObject(req.body, callback);
	    }
	    else {
		    var parser = new Busboy({ headers: req.headers });
		    req.pipe(parser);
		    readPostInternal(this, parser, callback);
		}
	}

	parseObject(obj, callback) {
		var parser = new EventEmitter();
		readPostInternal(this, parser, callback);
		Object.keys(obj).forEach((key) => {
			parser.emit("field", key, obj[key]);
		});
		parser.emit("finish");
	}

	objectToPostValues(obj, options) {
	    options = extend({
	        errorOnExtra: true
	    }, options);
	    var flatten = function (obj) {
    	    var ret = {};
	        for (var i in obj) {
	            var value = obj[i];
	            if (typeof value === "object") {
	                value = flatten(value);
	                for (var j in value) {
	                    ret[[i,j].join(".")] = value[j];
                    }
                }
                else {
                    ret[i] = value;
                }
            }
            return ret;
	    };
	    var flat = flatten(obj);
	    var post = {};
        this._fields.forEach(function (field) {
            var value = flat[field.name];
            if (value === null || value === undefined) {
                // DO NOTHING
            }
            else if (field.type === "date" || field.type === "date-time") {
                value = moment.utc(value, moment.ISO_8601).format(field.dateFormat);
            }
            else if (field.type === "number") {
                value = value.toString();
            }
            post[field.name] = value;
            delete flat[field.name];
        });
        if (Object.keys(flat).length > 0 && options.errorOnExtra) {
            throw new Error("Too many values", flat);
        }
        return post;
	}

	postValuesToObject(post) {
        var obj = {};
        this._fields.forEach(function (field) {
            var value = post[field.name];
            if (value === "" && field.emptyIsNull) {
                value = null;
            }
            if (value && field.type === "date") {
                value = moment.utc(value, field.dateFormat)
                    .toISOString()
                    .substr(0,10);
            }
            if (value && field.type === "date-time") {
                value = moment.utc(value, field.dateFormat)
                    .toISOString()
                    .substr(0,19);
            }
            if (value && field.type === "number") {
                value = Number(value);
            }
            var parts = field.name.split(".");
            var location = obj;
            for(var i = 0; i < parts.length - 1; i++) {
                location[parts[i]] = location[parts[i]] || {};
                location = location[parts[i]];
            }
            location[parts[parts.length-1]] = value;
        });
        return obj;
    }
}

module.exports = FormParser;

function readPostInternal (_this, parser, callback) {
	var form = _this._fields;

	var values = {};
	var errors = {};
	var extras = {};

	parser.on("field", function (name, value) {
		_this.emit("field", name, value);

		var field = form.find((field) => { return field.name == name; });
		if (field == null) {
			extras[name] = value;
			_this.emit("extra-field", name, value);
		}
		else {
			if (value == null) value = "";

			if (field.trim) {
				value = value.trim();
			}

			if (field.required && value.length == 0) {
				errors[name] = "required";
			}
			else if (
				value.length > 0 &&
				field.pattern &&
				!(new RegExp("^" + field.pattern + "$").test(value))
			) {
				errors[name] = "pattern";
			}
			else if (
				value.length > 0 &&
				field.type == "select"
			) {
				if (!field.options.some(function (x) {
					if (typeof(x) === 'string') return x == value;
					return x.value == value;
				})) {
					errors[name] = "not-available";
				}
			}
			else if (
				value.length > 0 &&
				(field.type == "date" || field.type == "date-time") &&
				!moment.utc(value, field.dateFormat, true).isValid()
			) {
				errors[name] = "This must be a valid date in the format " + field.dateFormat + ".";
			}

			values[name] = value;
			_this.emit("expected-field", name, value);
		}
	});
	parser.on("file", function (name, file, filename, encoding, mimetype) {
		var field = form.find((field) => { return field.name == name; });
	    var buffer = new Buffer([]);
	    file.on("data", function (data) {
	        buffer = Buffer.concat([buffer, data]);
	    });
	    file.on("end", function () {
	        if (filename === null || filename.length === 0) return;
	        var value = {
	            data: buffer.toString("base64"),
	            filename: filename,
	            encoding: encoding,
	            mimetype: mimetype
	        };
		    if (field == null) {
			    extras[name] = value;
			    _this.emit("extra-field", name, value);
		    }
		    else {
			    values[name] = value;
			    _this.emit("expected-field", name, value);
		    }
	    });
	});
	parser.on("finish", function () {
		form.forEach(function (field) {
			if (field.type === "info") return;
			if (!field.required) return;
			if (errors[field.name]) return;
			if (values[field.name]) return;
			errors[field.name] = "required";
		});
		if (Object.keys(errors).length == 0) errors = null;
		if (Object.keys(extras).length == 0) extras = null;
		if (Object.keys(values).length == 0) values = null;
		if (callback) callback(errors, values, extras);
		_this.emit("finish", errors, values, extras);
	});
	return parser;
};
