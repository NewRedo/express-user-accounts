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

module.exports = function(options) {
    options = extend({
        mountPoint: "/accounts",
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

    const app = require("express").Router();

    app.use(options.mountPoint, csrf({
        cookie: true
    }));

    app.use(function(req, res, next) {
        // Get the signed user cookie.
        var user = req.signedCookies["user"];

        // Check exprity of cookie as this can be spoofed.
        const now = moment();
        if (user) {
            const expires = moment(user.expires, moment.ISO_8601)
            if (expires.isBefore(now)) {
                res.clearCookie("user");
            }
        }

        // Make available to all templates.
        if (user) {
            req.user = user;
            res.locals.user = user;
        }

        // Automatically renew.
        if (user) {
            utils.renewCookie(req, res);
        }

        next();
    });

    app.use(options.mountPoint, function(req, res, next) {
        // Set up the template path.
        const originalRender = res.render;
        res.render = function(template) {
            originalRender.call(res, path.join(options.templatePath, template));
        };

        next();
    });

    app.get(options.mountPoint, function(req, res) {
        res.redirect(path.join(req.baseUrl, req.path, "login"));
    });

    app.use(
        path.join(options.mountPoint, "login"),
        require("./login")(options)
    );

    app.use(
        path.join(options.mountPoint, "register"),
        require("./register")(options)
    );

    app.use(
        path.join(options.mountPoint, "confirm-email"),
        require("./confirm-email")(options)
    );

    app.use(
        path.join(options.mountPoint, "recover"),
        require("./recover")(options)
    );

    app.use(
        path.join(options.mountPoint, "edit"),
        require("./edit")(options)
    );

    app.use(
        path.join(options.mountPoint, "logout"),
        require("./logout")(options)
    );

    return app;
}

module.exports.PouchDbStore = require("./pouchdb-store");