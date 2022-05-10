//import { apiHandler } from 'src/helpers/api-handler'
const { dbConfig } = require("../..//connections");
const  { v4 } = require("uuid")
const { PubSub, withFilter } = require('graphql-subscriptions');
const bcrypt = require("bcrypt");

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
            const upDatedFeedback = await db.findOne({ ID: feedbackID });

            pubsub.publish('FEEDBACK_UPDATED', { feedbackUpdated: upDatedFeedback }); 
            return upDatedFeedback;
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

            const upDatedFeedback = await db.findOne({ ID: feedbackID });
            console.log(upDatedFeedback);
            pubsub.publish("FEEDBACK_UPDATED", { feedbackUpdated: upDatedFeedback })
            return upDatedFeedback;
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
        },
        async deleteFeedback(_, { id }) {
            const { db }  = dbConfig;
            if(db === null) throw new Error("DB not set");

            const feedback = await db.findOne({ ID: id });
            if(feedback === null) throw new Error("Feedback not found");

            const result = await db.deleteOne({ ID: id });
            console.log(result);
            return true;

        },
        async upVoteFeedback(_, { id }) {
            const { db }  = dbConfig;
            if(db === null) throw new Error("DB not set");

            const feedback = await db.findOne({ ID: id });
            await db.updateOne({ ID: id }, { $set: { upVotes: feedback.upVotes + 1 }});
            
            const upDatedFeedback = await db.findOne({ ID: id });
            pubsub.publish("FEEDBACK_UPDATED", { feedbackUpdated: upDatedFeedback })
            return upDatedFeedback;
        },
        async login(_, { password, username }) {
            const { usersDB }  = dbConfig;
            if(usersDB === null) throw new Error("DB not set");

           // try {
                const user = await usersDB.findOne({ username });
                if(user === null) throw new Error("Username or password Invalid");

                if(await bcrypt.compare(password, user.password)) {
                    return { name: user.name, username };
                } else {
                    throw new Error("Username or password Invalid");
                }

            //} catch(err) {

           // }
        },
        async registerUser(_, { user }) {
            const { name, username, password } = user;
            const { usersDB }  = dbConfig;
            if(usersDB === null) throw new Error("DB not set");

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const oldUser = await usersDB.findOne({ username });

                if(oldUser === null) {
                    await usersDB.insertOne({
                        name,
                        password: hashedPassword,
                        username
                    });
                    return { name, username };
                }
            } catch(err) {
                console.log(err)
            }
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
                  console.log(payload)
                  return (payload.feedbackUpdated.ID === variables.id || variables.id === "null");
                },
            ),
        }
    }
};

module.exports = { resolvers };