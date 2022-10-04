import fs from "fs-extra";

class FileReplacer {
    constructor(f, options = {}) {
        this.file = f;
        this.options = options;

        // load content
        this.data = fs.readFileSync(f, "utf8");
    }

    replace(...args) {
        this.data = this.data.replace(...args);
        return this;
    }

    save() {
        fs.writeFileSync(this.file, this.data, {
            mode: this.options.mode || 0o755,
        });
        return this;
    }
}

export default function (f, options = {}) {
    return new FileReplacer(f, options);
}
