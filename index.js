const fs = require('fs');
const axios = require('axios');
const schedule = require('node-schedule');

const login_url = 'https://app.bupt.edu.cn/uc/wap/login/check';
const base_url = 'https://app.bupt.edu.cn/ncov/wap/default/index';
const base_url2 = 'https://app.bupt.edu.cn/xisuncov/wap/open-report/index';
const save_url1 = 'https://app.bupt.edu.cn/ncov/wap/default/save';
const save_url2 = 'https://app.bupt.edu.cn/xisuncov/wap/open-report/save';

let onUploadFailed;

let attemptToUpload = async (cookies, old_info, save_url) => {

    let payload = new URLSearchParams(old_info);

    let response = await axios.post(save_url, payload, { headers: { 'Cookie': cookies } });

    if (response.data['e'] !== 0 && response.data['e'] !== 1) {
        throw new Error(response.data['m']);
    }

    if (save_url === save_url1) {
        console.log(new Date().toString() + ' [Daily Report] ' + response.data['m']);
    } else if (save_url === save_url2) {
        console.log(new Date().toString() + ' [Midday Report] ' + response.data['m']);
    }
};


let attemptToLogin = async (user_authentication_json) => {

    let payload = new URLSearchParams(user_authentication_json);

    let cookies = await axios.post(login_url, payload)
        .then((response) => {
            if (response.data['e'] !== 0) {
                throw new Error(response.data['m']);
            }
            let cookies = '';
            let cookie_list = response['headers']['set-cookie'];
            for (const cookie of cookie_list) {
                cookies += cookie.split(';')[0] + '; ';
            }
            return cookies;
        });

    let old_info = await axios.get(base_url, { headers: { 'Cookie': cookies } })
        .then((response) => {
            const re = /oldInfo: ({[^\n]+})/;
            let old_info_str = response.data.match(re)[1];
            let old_info = JSON.parse(old_info_str);
            return old_info;
        });
    
    let old_info2 = await axios.get(base_url2, { headers: { 'Cookie': cookies } })
        .then((response) => {
            return response.data['d']['info'];
        });

    return { cookies: cookies, old_info: old_info, old_info2: old_info2 };
};

let checkAuthenticationValidation = async (json_data) => {
    let is_valid_authentication_json = 'username' in json_data
        && 'password' in json_data;

    if (!is_valid_authentication_json) {
        throw new Error('invalid authentication json');
    }
    return json_data;
};


let attemptToReportOnce = async (user_authentication_json) => {

    attemptToLogin(user_authentication_json).then((result) => {
        attemptToUpload(result.cookies, result.old_info, save_url1)
            .catch((e) => {
                onUploadFailed();
            });
    }).catch((e) => {
        console.log(new Date().toString() + '[Daily Report] ' + e.name + ': ' + e.message);
    });

    attemptToLogin(user_authentication_json).then((result) => {
        attemptToUpload(result.cookies, result.old_info2, save_url2)
            .catch((e) => {
                onUploadFailed();
            });
    }).catch((e) => {
        console.log(new Date().toString() + '[Midday Report] ' + e.name + ': ' + e.message);
    });

};

let reportWithBestEffort = (user_authentication_json, save_url) => {
    let backoff = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
    let idx = 0;

    onUploadFailed = () => {
        console.log(new Date().toString() + ' backoff: ' + backoff[idx] + ' second(s)');
        setTimeout(() => { attemptToReportOnce(user_authentication_json, save_url); }, backoff[idx] * 1000);
        idx++;
    };

    attemptToReportOnce(user_authentication_json, save_url);
}

let readFileCallback = (err, data) => {
    if (err) {
        console.error(err);
        return;
    }

    let foo = () => {
        checkAuthenticationValidation(JSON.parse(data))
            .then((user_authentication_json) => {
                reportWithBestEffort(user_authentication_json);
            })
            .catch((e) => {
                console.log(new Date().toString() + ' ' + e.name + ': ' + e.message);
            });
    };

    foo();
    for (let i = 0; i < 24; i++) {
        const job1 = schedule.scheduleJob({
            hour: i,
            minute: 1,
            second: 0
        }, foo);
    }
}


fs.readFile('./user_authentication.json', 'utf8', readFileCallback);

/*
reportOnce();
const job = schedule.scheduleJob({
    hour: 0,
    minute: 1,
    second: 31
}, reportOnce);*/

/*
report_once();
setInterval(report_once, 100000);*/
