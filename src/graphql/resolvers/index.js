//import { apiHandler } from 'src/helpers/api-handler'
const { dbConfig } = require("src/connections");
const  { v4 } = require("uuid")


export const resolvers = {
    Query: {
        async feedbacks() {
            const { db }  = dbConfig;
            if(db === null) throw new Error("DB not set");

            const feedbacks = await db.find({ }).toArray();
            return feedbacks;
        },
        async feedback(_, { id }) {
            const { db }  = dbConfig;
            if(db === null) throw new Error("DB not set");

            const feedback = await db.findOne({ ID: id });
            console.log(feedback)
            if(feedback === null) throw new Error("Feedback not found");

            return feedback;
        }
    },
    Mutation: {
        async addComment(_, { comment }) {
            const { db }  = dbConfig;
            if(db === null) throw new Error("DB not set");

            const { feedbackID } = comment;
            const feedback = await db.findOne({ ID: feedbackID });

            if(feedback === null) throw new Error("Feedback not found");

            const ID = v4();
            const comments = [ ...feedback.comments, { ID, ...comment }];
            await db.updateOne({ ID: feedbackID }, { $set: { comments } });

            const result = await db.findOne({ comments: { ID } });
            console.log(result);
            return result;
        },
        async addCommentReply(_, { reply }) {
            const { db }  = dbConfig;
            if(db === null) throw new Error("DB not set");

            const { content, commentID, feedbackID, replyingTo, user } = reply;
            const feedback = await db.findOne({ ID: feedbackID });
            const comment = feedback.comments.find(item => item.ID === commentID);
            console.log(comment)

            if(feedback === null || !Boolean(comment)) throw new Error("Feedback or Comment not found");

            //const ID = v4();
            const newReply = { content, replyingTo, user };
            comment["replies"] = [ ...comment.replies, newReply ];
            await db.updateOne({ ID: feedbackID }, { $set: { comments: feedback.comments } });

            //const result = await db.findOne({ "comments.replies": { ID } });
            //console.log(result);
            return { content, replyingTo, user };
        },
        async addFeedback(_, { feedback }) {
            const { db }  = dbConfig;
            if(db === null) throw new Error("DB not set");

            const ID = v4();
            await db.insertOne({
                ID,
                ...feedback,
                comments: []
            });

            const result = await db.findOne({ ID })
            return result;
        }
    }
};