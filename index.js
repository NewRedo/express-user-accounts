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
const htmlToText = require('nodemailer-html-to-text').htmlToText;
const path = require("path");
const UserService = require("./service");
const nodeMailer = require("nodemailer");
const utils = require("./utils");
const csrf = require('csurf');

class ExpressUserAccounts {
    constructor(options) {
        options = extend({
            templatePath: path.join(".", "user-accounts"),
            store: {
                get: function() {
                    throw new Error("storage.get is not implemented.");
                },
                put: function() {
                    throw new Error("storage.put is not implemented.");
                },
                findByEmail: function() {
                    throw new Error("storage.find is not implemented.");
                }
            },
            mailTransport: nodeMailer.createTransport({
                host: "localhost",
                port: 25,
                tls: {
                    rejectUnauthorized: false
                }
            })
        }, options);

        // Automatic conversion of HTML to text emails.
        options.mailTransport.use("compile", htmlToText());
        options.service = new UserService(options);

        this._options = options;
    }

    createMiddleware() {

        const app = require("express").Router();

        app.use(function(req, res, next) {
            // Get the signed user cookie.
            var cookie = req.signedCookies["user"];

            // Check exprity of cookie as this can be spoofed.
            const now = moment();
            if (cookie) {
                const expires = moment(cookie.expires, moment.ISO_8601);
                if (expires.isBefore(now)) {
                    res.clearCookie("user");
                }
            }

            // Make available to all templates.
            if (cookie) {
                req.user = cookie.user;
                res.locals.user = cookie.user;
            }

            // Automatically renew.
            if (cookie) {
                utils.renewCookie(req, res);
            }

            next();
        });

        return app;
    }

    createUserInterface() {
        const options = this._options;
        const app = require("express").Router();

        app.use(csrf({
            cookie: true
        }));

        app.use(function(req, res, next) {
            // Set up the template path.
            const originalRender = res.render;
            res.render = function(template) {
                originalRender.call(res, path.join(options.templatePath, template));
            };

            next();
        });

        app.get("/", function(req, res) {
            res.redirect(path.join(req.baseUrl, req.path, "login"));
        });

        app.use("/login", require("./login")(options));
        app.use("/register", require("./register")(options));
        app.use("/confirm-email", require("./confirm-email")(options));
        app.use("/recover", require("./recover")(options));
        app.use("/edit", require("./edit")(options));
        app.use("/logout", require("./logout")(options));

        return app;
    }
}

module.exports = ExpressUserAccounts;
module.exports.PouchDbStore = require("./pouchdb-store");