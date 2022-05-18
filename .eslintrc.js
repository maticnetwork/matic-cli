module.exports = {
    "extends": "standard",
    "rules": {
        "space-before-function-paren": ["error", {
            "anonymous": "always",
            "named": "never",
            "asyncArrow": "always",
            "parser": "@babel/eslint-parser"
        }],
    }
};
