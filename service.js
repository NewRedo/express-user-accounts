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

const assert = require("assert");
const async = require("async");
const bcrypt = require("bcrypt");
const SALT_WORK_FACTOR = 10;
const uuid = require("uuid");

class Service {
    constructor(options) {
        this._options = options;
    }

    get(id, callback) {
        this._options.store.get(id, (err, user) => {
            if (!err) {
                delete user.bcryptedPassword;
            }
            callback(err, user);
        });
    }

    authenticate(args, callback) {
        assert(args);
        assert(args.email);
        assert(args.password);
        async.waterfall([
            cb => this._options.store.findByEmail(args.email, cb),
            (user, cb) => {
                if (!user) {
                    callback(null, null);
                    return;
                }
                bcrypt.compare(args.password, user.bcryptedPassword, function(err, isMatch) {
                    if (!err) {
                        if (!isMatch) user = null;
                    }
                    cb(err, user)
                });
            }
        ], callback);
    }

    register(args, callback) {
        async.waterfall([
            cb => this._options.store.findByEmail(args.username, cb),
            (user, cb) => {
                if (user) {
                    var err = new Error("Email already taken.");
                    err.code = "EDUPLICATE";
                    err.user = user;
                    callback(err);
                    return;
                }
                bcrypt.genSalt(SALT_WORK_FACTOR, cb)
            },
            (salt, cb) => bcrypt.hash(args.password, salt, cb),
            (hash, cb) => {
                args.bcryptedPassword = hash;
                delete args.password;
                args.id = uuid();
                this._options.store.put(args, cb);
            },
            cb => {
                cb(null, args);
            }
        ], callback);
    }

    update(args, callback) {
        if (args.newPassword) {
            async.waterfall([
                cb => bcrypt.genSalt(SALT_WORK_FACTOR, cb),
                (salt, cb) => bcrypt.hash(args.newPassword, salt, cb),
                (hash, cb) => {
                    args.bcryptedPassword = hash;
                    delete args.newPassword;
                    this._options.store.put(args, cb);
                },
                cb => {
                    cb(null, args);
                }
            ], callback);
        } else {
            async.waterfall([
                cb => {
                    this._options.store.put(args, cb);
                },
                cb => {
                    cb(null, args);
                }
            ], callback);
        }
    }

    findByEmail(email, callback) {
        this._options.store.findByEmail(email, callback);
    }

    recover(args, callback) {
        assert(args);
        assert(args.email);
        assert(args.password);
        async.waterfall([
            cb => bcrypt.genSalt(SALT_WORK_FACTOR, cb),
            (salt, cb) => bcrypt.hash(args.password, salt, cb),
            (hash, cb) => this._options.store.findByEmail(args.email, (err, user) => {
                cb(err, hash, user);
            }),
            (hash, user, cb) => {
                user.bcryptedPassword = hash;
                this._options.store.put(user, (err) => {
                    cb(err, user);
                });
            }
        ], callback);
    }

    /*
    Confirms and email address and returns the updated user object.
    */
    confirmEmailAddress(args, callback) {
        async.waterfall([
            // Get the user
            cb => this._options.store.get(args.id, cb),

            // Add the email address to the user.
            (user, cb) => {
                if (!user.emails) user.emails = [];
                user.emails = [{
                    value: args.email
                }];
                user.username = args.email;
                this._options.store.put(user, cb);
            },
            cb => this._options.store.get(args.id, cb)
        ], callback);
    }

    sendEmail(email) {
        this._options.mailTransport.sendMail(email);
    }
}

module.exports = Service;
