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

const express = require("express");
const path = require("path");
const multer = require("multer");
const moment = require("moment");
const url = require("url");
const querystring = require("querystring");
const toMarkdown = require("to-markdown");
const pug = require("pug");
const FormParser = require("./form-parser");
const utils = require("./utils");

module.exports = function(options) {

    var app = express.Router();

    app.all("/", function(req, res, next) {
        res.locals._csrf = req.csrfToken();
        res.locals.form = [{
                name: "givenName",
                label: "Given name",
                type: "text",
                required: true,
                maxlength: 120
            },
            {
                name: "middleName",
                label: "Middle name (optional)",
                type: "text",
                required: false,
                maxlength: 120
            },
            {
                name: "familyName",
                label: "Family name",
                type: "text",
                required: true,
                maxlength: 120
            },
            {
                name: "email",
                label: "Email address",
                type: "email",
                title: "A valid email address is like name@domain.com",
                required: true
            },
            {
                name: "password",
                label: "Choose a password",
                type: "password",
                required: true,
                minlength: 10
            },
            {
                name: "confirmPassword",
                label: "Confirm your password",
                type: "password",
                required: true
            }
        ];

        next();
    });

    app.post("/", function(req, res, next) {
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
                res.render("register");
            } else {
                next();
            }
        });
    });

    app.post("/", [
        function(req, res, callback) {
            var updatedUser = {
                username: req.body.email,
                name: {
                    familyName: req.body.familyName,
                    givenName: req.body.givenName
                },
                password: req.body.password
            }
            options.service.register(updatedUser, (err, user) => {
                if (!err) {
                    req.user = user;
                    callback(null);
                } else if (err.code === "EDUPLICATE") {
                    // Allow the user to confirm their email address.
                    user = err.user;
                    err = null;
                    const token = utils.encodeToken({
                        id: user.id,
                        email: req.body.email
                    }, req.secret);
                    const confirmationUrl = url.format({
                        protocol: req.protocol,
                        host: req.get("host"),
                        pathname: path.join(req.baseUrl, "..", "recover/complete"),
                        search: querystring.stringify({
                            "return-url": req.query["return-url"],
                            "token": token
                        })
                    });
                    const email = {
                        to: req.body.email
                    };
                    const data = {
                        user: updatedUser,
                        confirmationUrl,
                        email // Allow template to override email settings
                    };

                    // Use express rendering configuration to render the content.
                    const template = path.join(options.templatePath, "recover-email");
                    req.app.render(template, data, (err, html) => {
                        if (err) {
                            callback(err);
                            return;
                        }
                        email.html = html;
                        email.text = toMarkdown(html);
                        options.service.sendEmail(email);
                        res.redirect(path.join(req.baseUrl, "pending"));
                        return;
                    });
                } else {
                    callback(err);
                }
            });
        },
        function(req, res, callback) {
            // Require the user to confirm their email address.
            const token = utils.encodeToken({
                id: req.user.id,
                email: req.body.email
            }, req.secret);
            const confirmationUrl = url.format({
                protocol: req.protocol,
                host: req.get("host"),
                pathname: path.join(req.baseUrl, req.path, "..", "confirm-email"),
                search: querystring.stringify({
                    "return-url": req.query["return-url"],
                    "token": token
                })
            });
            const email = {
                to: req.body.email
            };
            const data = {
                user: req.user,
                confirmationUrl,
                email // Allow template to override email settings
            };

            // Use express rendering configuration to render the content.
            const template = path.join(options.templatePath, "confirm-email");
            req.app.render(template, data, (err, html) => {
                if (err) {
                    callback(err);
                    return;
                }
                email.html = html;
                email.text = toMarkdown(html);
                options.service.sendEmail(email);
                res.redirect(path.join(req.baseUrl, req.path, "pending"));
            });
        }
    ]);

    app.all("/", function(req, res, callback) {
        res.render("register");
    });

    app.get("/pending", function(req, res, callback) {
        res.render("register-pending");
    });

    return app;
};