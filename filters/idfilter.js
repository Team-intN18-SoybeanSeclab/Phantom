class IdCardFilter {
    constructor() {

        this.provinceCodes = {
            '11': '北京', '12': '天津', '13': '河北', '14': '山西', '15': '内蒙古',
            '21': '辽宁', '22': '吉林', '23': '黑龙江',
            '31': '上海', '32': '江苏', '33': '浙江', '34': '安徽', '35': '福建', '36': '江西', '37': '山东',
            '41': '河南', '42': '湖北', '43': '湖南', '44': '广东', '45': '广西', '46': '海南',
            '50': '重庆', '51': '四川', '52': '贵州', '53': '云南', '54': '西藏',
            '61': '陕西', '62': '甘肃', '63': '青海', '64': '宁夏', '65': '新疆',
            '71': '台湾', '81': '香港', '82': '澳门'
        };


        this.weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];

        this.checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    }


    validate(idCard) {
        if (!idCard) {
            return { valid: false, error: '身份证号码不能为空' };
        }


        idCard = idCard.replace(/\s/g, '').toUpperCase();


        if (idCard.length !== 15 && idCard.length !== 18) {
            return { valid: false, error: '身份证号码长度不正确' };
        }


        if (idCard.length === 15) {
            return this.validate15(idCard);
        } else {
            return this.validate18(idCard);
        }
    }


    validate15(idCard) {

        if (!/^\d{15}$/.test(idCard)) {
            return { valid: false, error: '15位身份证号码格式不正确' };
        }


        const provinceCode = idCard.substring(0, 2);
        if (!this.provinceCodes[provinceCode]) {
            return { valid: false, error: '省份代码不正确' };
        }


        const year = parseInt('19' + idCard.substring(6, 8));
        const month = parseInt(idCard.substring(8, 10));
        const day = parseInt(idCard.substring(10, 12));

        if (!this.isValidDate(year, month, day)) {
            return { valid: false, error: '出生日期不正确' };
        }

        return {
            valid: true,
            type: '15位身份证',
            province: this.provinceCodes[provinceCode],
            birthDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
            gender: parseInt(idCard.charAt(14)) % 2 === 0 ? '女' : '男'
        };
    }


    validate18(idCard) {

        if (!/^\d{17}[\dX]$/.test(idCard)) {
            return { valid: false, error: '18位身份证号码格式不正确' };
        }


        const provinceCode = idCard.substring(0, 2);
        if (!this.provinceCodes[provinceCode]) {
            return { valid: false, error: '省份代码不正确' };
        }


        const year = parseInt(idCard.substring(6, 10));
        const month = parseInt(idCard.substring(10, 12));
        const day = parseInt(idCard.substring(12, 14));

        if (!this.isValidDate(year, month, day)) {
            return { valid: false, error: '出生日期不正确' };
        }


        if (!this.validateCheckCode(idCard)) {
            return { valid: false, error: '校验码不正确' };
        }

        return {
            valid: true,
            type: '18位身份证',
            province: this.provinceCodes[provinceCode],
            birthDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
            gender: parseInt(idCard.charAt(16)) % 2 === 0 ? '女' : '男'
        };
    }


    isValidDate(year, month, day) {

        const currentYear = new Date().getFullYear();
        if (year < 1900 || year > currentYear) {
            return false;
        }


        if (month < 1 || month > 12) {
            return false;
        }


        const daysInMonth = new Date(year, month, 0).getDate();
        if (day < 1 || day > daysInMonth) {
            return false;
        }

        return true;
    }


    validateCheckCode(idCard) {
        let sum = 0;
        for (let i = 0; i < 17; i++) {
            sum += parseInt(idCard.charAt(i)) * this.weights[i];
        }
        const checkCodeIndex = sum % 11;
        const expectedCheckCode = this.checkCodes[checkCodeIndex];
        return idCard.charAt(17) === expectedCheckCode;
    }


    extractIdCards(text) {
        if (!text) return [];

        const idCards = [];


        const regex18 = /\b\d{17}[\dX]\b/g;

        const regex15 = /\b\d{15}\b/g;

        let matches;


        while ((matches = regex18.exec(text)) !== null) {
            const idCard = matches[0];
            const result = this.validate(idCard);
            if (result.valid) {
                idCards.push({
                    value: idCard,
                    position: matches.index,
                    ...result
                });
            }
        }


        while ((matches = regex15.exec(text)) !== null) {
            const idCard = matches[0];
            const result = this.validate(idCard);
            if (result.valid) {
                idCards.push({
                    value: idCard,
                    position: matches.index,
                    ...result
                });
            }
        }

        return idCards;
    }


    hasIdCard(text) {
        return this.extractIdCards(text).length > 0;
    }


    maskIdCard(idCard, maskChar = '*') {
        if (!idCard) return '';

        const result = this.validate(idCard);
        if (!result.valid) return idCard;

        if (idCard.length === 15) {

            return idCard.substring(0, 6) + maskChar.repeat(6) + idCard.substring(12);
        } else {

            return idCard.substring(0, 6) + maskChar.repeat(8) + idCard.substring(14);
        }
    }
}


const idCardFilter = new IdCardFilter();


if (typeof module !== 'undefined' && module.exports) {
    module.exports = idCardFilter;
} else if (typeof window !== 'undefined') {
    window.idCardFilter = idCardFilter;
}