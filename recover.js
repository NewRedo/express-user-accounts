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

const async = require("async");
const express = require("express");
const path = require("path");
const multer = require("multer");
const moment = require("moment");
const url = require("url");
const querystring = require("querystring");
const toMarkdown = require("to-markdown");
const jade = require("jade");
const FormParser = require("./form-parser");
const utils = require("./utils");

module.exports = function (options) {

    var app = express.Router();

    app.all("/", function (req, res, next) {
        res.locals._csrf = req.csrfToken();
        res.locals.form = [
            {
                name: "email",
                label: "Email address",
                type: "email",
                title: "A valid email address is like name@domain.com",
                required: true
            }
        ];

        next();
    });

    app.post("/", function (req, res, next) {
        const parser = new FormParser(res.locals.form);
        parser.parsePost(req, (errors, values, extras) => {
            res.locals.values = values;
            res.locals.errors = errors;
            if (errors) {
                res.render("recover");
            }
            else {
                next();
            }
        });
    });

    app.post("/", function (req, res, callback) {
        async.waterfall([
            cb => options.service.findByEmail(req.body.email, cb),
            (user, cb) => {
                if (!user) {
                    res.redirect(path.join(req.baseUrl, "pending"));
                    return;
                }

                // Allow the user to confirm their email address.
                const token = utils.encodeToken({
                    email: req.body.email
                }, req.secret);
                const confirmationUrl = url.format({
                    protocol: req.protocol,
                    host: req.get("host"),
                    pathname: path.join(req.baseUrl, "complete"),
                    search: querystring.stringify({
                        "return-url": req.query["return-url"],
                        "token": token
                    })
                });
                const email = {
                    to: req.body.email
                };
                const data = {
                    user,
                    confirmationUrl,
                    email // Allow template to override email settings
                };

                // Use express rendering configuration to render the content.
                const template = path.join(options.templatePath, "recover-email");
                req.app.render(template, data, (err, html) => {
                    if (err) {
                        cb(err);
                        return;
                    }
                    email.html = html;
                    email.text = toMarkdown(html);
                    options.service.sendEmail(email);
                    res.redirect(path.join(req.baseUrl, "pending"));
                });
            }
        ], callback);
    });

    app.all("/", function (req, res, callback) {
        res.render("recover");
    });

    app.get("/pending", function (req, res, callback) {
        res.render("recover-pending");
    });

    app.all("/complete", function (req, res, next) {
        if (!req.query.token) {
            res.status(401, "Bad request").end();
            return;
        }
        const payload = utils.decodeToken(req.query.token, req.secret);
        if (!payload) {
            res.status(401, "Bad request").end();
            return;
        }
        res.locals._csrf = req.csrfToken();
        res.locals.form = [
            {
                name: "email",
                type: "text",
                readonly: true,
                value: payload.email
            },
            {
                name: "password",
                type: "password",
                minlength: 10,
                required: true
            },
            {
                name: "confirmPassword",
                type: "password",
                minlength: 10,
                required: true
            }
        ];
        res.locals.values = {
            email: payload.email
        };
        res.locals.payload = payload;
        next();
    });

    app.post("/complete", function (req, res, next) {
        const parser = new FormParser(res.locals.form);
        parser.parsePost(req, (errors, values, extras) => {
            // Special validation...
            if (!errors) {
                if (req.body.password !== req.body.confirmPassword) {
                    errors = {
                        confirmPassword: "Does not match"
                    };
                }
            }

            if (errors) {
                res.locals.values = values;
                res.locals.errors = errors;
                res.render("recover-complete");
            }
            else {
                next();
            }
        });
    });

    app.post("/complete", function (req, res, next) {
        async.waterfall([
            cb => options.service.recover(req.body, cb),
            (user, cb) => {
                req.user = user;
                utils.renewCookie(req, res);
                res.redirect(req.query["return-url"]);
            }
        ], next);
    });

    app.all("/complete", function (req, res, next) {
        res.render("recover-complete");
    });

    return app;
};
