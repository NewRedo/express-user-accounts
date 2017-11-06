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

const cookieSignature = require('cookie-signature');
const base64url = require("base64url");
const assert = require("assert");
const moment = require("moment");
const zlib = require("zlib");

function renewCookie (req, res) {
    const expires = moment.utc().add(1, "hour");
    req.user.expires = expires.toISOString();
    res.cookie(
        "user",
        req.user,
        {
            expires: expires.toDate(),
            signed: true,
            secure: req.secure,
            sameSite: true
        }
    );
    return req, res;
}

function encodeToken (data, secret, ttlMinutes) {
    assert(secret);
    assert(data);
    ttlMinutes = ttlMinutes || 60;
    var payload = {
        data,
        expires: moment().add(ttlMinutes, "minutes").toISOString()
    };
    payload = JSON.stringify(payload);
    payload = cookieSignature.sign(payload, secret);
    payload = zlib.deflateRawSync(payload);
    payload = base64url.encode(payload);
    return payload;
}

function decodeToken (token, secret) {
    assert(secret);
    assert(token);
    var payload = base64url.toBuffer(token);
    payload = zlib.inflateRawSync(payload).toString();
    payload = cookieSignature.unsign(payload, secret);
    if (payload == null) return null;
    payload = JSON.parse(payload);
    var expiry = moment(payload.expires, moment.ISO_8601);
    if (expiry.isBefore(moment())) return null;
    return payload.data;
}

module.exports = {
    renewCookie,
    encodeToken,
    decodeToken
};
