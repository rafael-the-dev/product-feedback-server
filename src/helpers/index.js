const { ApolloError, UserInputError } = require("apollo-server-express")

const fetchByID = async ({ db, errorMessage, filter }) => {
    const result = await db.findOne(filter);
    
    if(result === null) throw new UserInputError(errorMessage);

    return result;
};

const hasDB = ({ dbConfig, key }) => {
    let result = null;

    if(key === "feedbacksDB") {
        result = dbConfig.db;
    } else if(key === "usersDB") {
        result = dbConfig.usersDB
    }

    if(result === null) throw new ApolloError("DB connection closed");
    return result;
};

module.exports = { fetchByID, hasDB };