const { UserInputError } = require("apollo-server-express")

const fetchByID = async ({ db, errorMessage, filter }) => {
    const result = await db.findOne(filter);

    if(result === null) throw new UserInputError(errorMessage);

    return result;
};

module.exports = { fetchByID };