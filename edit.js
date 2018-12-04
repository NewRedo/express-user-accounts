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

const extend = require("extend");
const url = require("url");
const path = require("path");
const querystring = require("querystring");
const pug = require("pug");
const FormParser = require("./form-parser");
const utils = require("./utils");

module.exports = function(options) {
    options = extend({}, options);

    const app = require("express").Router();

    app.use(function(req, res, next) {
        if (!req.user) {
            var loginUrl = {
                protocol: req.protocol,
                host: req.get("Host"),
                pathname: "accounts/login",
                query: {
                    "return-url": req.originalUrl
                }
            };
            res.redirect(url.format(loginUrl));
        } else {
            next();
        }
    });

    app.all("/", function(req, res, next) {
        res.locals._csrf = req.csrfToken();
        res.locals.form = [{
                name: "givenName",
                label: "Given name",
                required: false,
                maxLength: 120
            },
            {
                name: "familyName",
                label: "Family name",
                required: false,
                maxLength: 120
            },
            {
                name: "email",
                label: "Email address",
                type: "email",
                title: "A valid email address is like name@domain.com",
                required: false
            },
            {
                name: "newPassword",
                label: "New password",
                type: "password",
                required: false,
                minlength: 10
            },
            {
                name: "confirmNewPassword",
                label: "Confirm new password",
                type: "password",
                required: false
            }
        ];
        next();
    });

    app.get("/", function(req, res, next) {
        //map the user fields to the form fields
        var values = {
            givenName: req.user.name.givenName,
            familyName: req.user.name.familyName,
            email: req.user.username
        }
        res.locals.values = values;
        next();
    })

    app.post("/", function(req, res, next) {
        const parser = new FormParser(res.locals.form);
        parser.parsePost(req, (errors, values, extras) => {
            if (req.body.newPassword !== req.body.confirmNewPassword) {
                if (errors) {
                    errors.password = "Passwords don't match.";
                } else {
                    errors = {
                        "password": "Passwords don't match."
                    };
                }
            }
            res.locals.values = values;
            res.locals.errors = errors;
            if (errors) {
                res.render("edit");
            } else {
                next();
            }
        });
    });

    app.post("/", [
        function(req, res, next) {
            // We need to raw record to update it, otherwise we lose some
            // the password and risk poluting the record with runtime data.
            options.service.get(req.user.id, function(err, user) {
                if (!err) {
                    res.locals.userToUpdate = user;
                }
                next(err);
            });
        },
        function(req, res, next) {
            var updatedUser = extend(res.locals.userToUpdate, {});
            if (req.body.familyName) updatedUser.name.familyName = req.body.familyName;
            if (req.body.givenName) updatedUser.name.givenName = req.body.givenName;
            if (req.body.newPassword) updatedUser.newPassword = req.body.newPassword;
            options.service.update(updatedUser, function(err, user) {
                if (!err) {
                    utils.setUser(req, user);
                }
                next(err);
            });
        },
        function(req, res, next) {
            if (req.body.email && req.body.email !== req.user.username) {
                // Set the user cookie.
                utils.renewCookie(req, res);

                options.service.findByEmail(req.body.email, (err, user) => {
                    if (err) {
                        next(err);
                    } else if (!user) {
                        // Allow the user to confirm their email address.
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
                        var email = {
                            to: req.body.email
                        };
                        var data = {
                            user: req.user,
                            confirmationUrl,
                            email // Allow template to override email settings
                        };

                        // Use express rendering configuration to render the content.
                        var template = path.join(options.templatePath, "confirm-email-change-email");
                        req.app.render(template, data, (err, html) => {
                            if (err) {
                                next(err);
                                return;
                            }
                            email.html = html;
                            options.service.sendEmail(email);
                            next();
                        });
                    } else {
                        // The email is already in use, start the account recovery process for that address.
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
                            user: user,
                            confirmationUrl,
                            email // Allow template to override email settings
                        };

                        // Use express rendering configuration to render the content.
                        const template = path.join(options.templatePath, "recover-email");
                        req.app.render(template, data, (err, html) => {
                            if (err) {
                                next(err);
                                return;
                            }
                            email.html = html;
                            options.service.sendEmail(email);
                            next();
                        });
                    }
                });
            } else {
                next();
            }
        },
        function(req, res, next) {
            if (req.body.email && req.body.email !== req.user.username) {
                var email = {
                    to: req.user.username
                }
                var data = {
                    user: req.user,
                    email
                }
                var template = path.join(options.templatePath, "email-change-notification-email");
                req.app.render(template, data, (err, html) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    email.html = html;
                    options.service.sendEmail(email);
                    res.redirect(path.join(req.baseUrl, req.path, "..", "register/pending"));
                });
            } else {
                next();
            }
        },
        function(req, res, next) {
            utils.renewCookie(req, res);
            res.redirect(req.query["return-url"]);
        }
    ]);

    app.all("/", function(req, res, next) {
        res.render("edit");
    });

    return app;
}