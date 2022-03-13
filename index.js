const fs = require('fs');
const axios = require('axios');

const login_url = 'https://app.bupt.edu.cn/uc/wap/login/check';
const base_url = 'https://app.bupt.edu.cn/ncov/wap/default/index';
const save_url = 'https://app.bupt.edu.cn/ncov/wap/default/save';

let attemptToUpload = async (cookies, old_info) => {

    let payload = new URLSearchParams(old_info);

    let response = await axios.post(save_url, payload, { headers: { 'Cookie': cookies } });

    console.log(response.data);
}

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

    return { cookies: cookies, old_info: old_info };
}

let onReadUserAuthenticationSuccess = async (json_data) => {
    let is_valid_authentication_json = 'username' in json_data
        && 'password' in json_data;

    if (!is_valid_authentication_json) {
        console.log('invalid authentication json');
        return;
    }
    return json_data;
};

let report_once = () => {
    fs.readFile('./user_authentication.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        onReadUserAuthenticationSuccess(JSON.parse(data))
            .then((user_authentication_json_data) => {
                return attemptToLogin(user_authentication_json_data);
            })
            .then((result) => {
                attemptToUpload(result.cookies, result.old_info);
            })
            .catch((e) => {
                console.log(e.name + ': ' + e.message);
            });
    });
};

report_once();
setInterval(report_once, 100000);
