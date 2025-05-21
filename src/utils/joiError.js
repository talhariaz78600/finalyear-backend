const joiError = (error) => {
    const errorFields = error.details.reduce((acc, err) => {
        acc[err.context.key] = err.message.replace(/['"]/g, '');
        return acc;
    }, {});
    return errorFields;
}

module.exports = joiError;