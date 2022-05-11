const validator = ({ list }) => {
    const errors = {};

    list.forEach(item => {
        item[1].forEach(name => {
            if(name === "whitespace") {
                errors[name] = [ ...errors[name], "Should not contain whitespace" ];
            }

            if(name === "whitespace") {
                errors[name] = [ ...errors[name], "Should not contain whitespace" ];
            }
        })
    });
};

module.exports = { validator };