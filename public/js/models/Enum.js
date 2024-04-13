export class Enum {
    constructor(values) {
        this.values = values;
        for (const key in values) {
            if (values.hasOwnProperty(key)) {
                this[key] = values[key];
            }
        }
    }

    fromInt(value) {
        return Object.keys(this.values).find(key => this.values[key] === value);
    }

    toInt(key) {
        return this.values[key];
    }
}