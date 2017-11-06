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

const moment = require("moment");
const extend = require("extend");
const path = require("path");
const querystring = require("querystring");
const FormParser = require("./form-parser");
const utils = require("./utils");

module.exports = function (options) {
    options = extend({
    }, options);

    const app = require("express").Router();

    app.all("/", function (req, res, next) {
        res.locals._csrf = req.csrfToken();
        res.locals.form = [
	        {
		        name: "email",
		        label: "Email Address",
		        required: true,
		        type: "email",
		        help: "Required."
	        },
	        {
		        type: "password",
		        name: "password",
		        label: "Password",
		        required: true,
		        help: "Required."
	        }
        ];
        res.locals.registerUrl =
            path.join(req.baseUrl, req.path, "..", "register") +
            "?" + querystring.stringify(req.query);
        res.locals.recoveryUrl =
            path.join(req.baseUrl, req.path, "..", "recover") +
            "?" + querystring.stringify(req.query);
        next();
    });

    app.post("/", function (req, res, next) {
        const parser = new FormParser(res.locals.form);
        parser.parsePost(req, (errors, values, extras) => {
            res.locals.values = values;
            res.locals.errors = errors;
            if (errors) {
                res.render("login");
            }
            else {
                next();
            }
        });
    });

    app.post("/", function (req, res, next) {
        options.service.authenticate(req.body, (err, user) => {
            if (err) {
                next(err);
                return;
            }

            if (!user) {
                res.locals.error = "Unknown email or wrong password.";
                next();
                return;
            }
            req.user = user;
            utils.renewCookie(req, res);

            res.redirect(req.query["return-url"]);
        });
    });

    app.all("/", function (req, res) {
        res.render("login");
    });

    return app;
}
