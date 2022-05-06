//import { apiHandler } from 'src/helpers/api-handler'
const { dbConfig } = require("../..//connections");
const  { v4 } = require("uuid")
const { PubSub, withFilter } = require('graphql-subscriptions');

const pubsub = new PubSub();

const resolvers = {
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
            //console.log(feedback)
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
            const newComment = { ID, ...comment };
            const comments = [ ...feedback.comments, newComment];
            await db.updateOne({ ID: feedbackID }, { $set: { comments } });

            //const result = await db.findOne({ comments: { ID } });
            //console.log("result", newComment);
            pubsub.publish('FEEDBACK_UPDATED', { feedbackUpdated: newComment }); 
            return newComment;
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

            const result = await db.findOne({ ID });
            pubsub.publish('FEEDBACK_CREATED', { feedbackCreated: result }); 
            return result;
        }
    },
    Subscription: {
        feedbackCreated: {
            subscribe: () => pubsub.asyncIterator(['FEEDBACK_CREATED'])
        },
        feedbackUpdated: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(['FEEDBACK_UPDATED']),
                (payload, variables) => {
                  // Only push an update if the comment is on
                  // the correct repository for this operation
                  return (payload.feedbackUpdated.feedbackID === variables.id);
                },
              ),
        }
    }
};

module.exports = { resolvers };