const  { v4 } = require("uuid")
const { PubSub, withFilter } = require('graphql-subscriptions');
const bcrypt = require("bcrypt");
const { UserInputError } = require("apollo-server-express")

const { dbConfig } = require("../../connections");
const { validator } = require("../../validations")
const { fetchByID, hasDB } = require("../../helpers")

const pubsub = new PubSub();

const resolvers = {
    Query: {
        async feedbacks() {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const feedbacks = await db.find({ }).toArray();
            return feedbacks;
        },
        async feedback(_, { id }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const feedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: id } }) //db.findOne({ ID: id });

            return feedback;
        }
    },
    Mutation: {
        async addComment(_, { comment }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const { feedbackID } = comment;
            const feedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: feedbackID } });//await db.findOne({ ID: feedbackID });

            const ID = v4();
            const newComment = { ID, ...comment };
            const comments = [ ...feedback.comments, newComment];
            await db.updateOne({ ID: feedbackID }, { $set: { comments } });

            const upDatedFeedback = await db.findOne({ ID: feedbackID });

            pubsub.publish('FEEDBACK_UPDATED', { feedbackUpdated: upDatedFeedback }); 
            return upDatedFeedback;
        },
        async addCommentReply(_, { reply }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const { content, commentID, feedbackID, replyingTo, user } = reply;
            const feedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: feedbackID } });//await db.findOne({ ID: feedbackID });
            
            const comment = feedback.comments.find(item => item.ID === commentID);

            if(!Boolean(comment)) throw new Error("Comment not found");

            const newReply = { content, replyingTo, user };
            comment["replies"] = [ ...comment.replies, newReply ];
            await db.updateOne({ ID: feedbackID }, { $set: { comments: feedback.comments } });

            const upDatedFeedback = await db.findOne({ ID: feedbackID });
            pubsub.publish("FEEDBACK_UPDATED", { feedbackUpdated: upDatedFeedback });
            return upDatedFeedback;
        },
        async addFeedback(_, { feedback }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

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
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const feedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: id } });//await db.findOne({ ID: id });

            await db.deleteOne({ ID: id });
            const feedbackDeleted = { ID: id, status: "deleted" };
            pubsub.publish('FEEDBACK_DELETED', { feedbackDeleted }); 
            return feedbackDeleted;

        },
        async editFeedback(_, { feedback, id }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            let savedFeedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: id } });//await db.findOne({ ID: id });

            await db.updateOne({ ID: id }, { $set: { ...feedback }});
            savedFeedback = await db.findOne({ ID: id });
            pubsub.publish("FEEDBACK_UPDATED", { feedbackUpdated: savedFeedback });
            return savedFeedback;

        },
        async upVoteFeedback(_, { id }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const feedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: id } });//await db.findOne({ ID: id });
            await db.updateOne({ ID: id }, { $set: { upVotes: feedback.upVotes + 1 }});
            
            const upDatedFeedback = await db.findOne({ ID: id });
            pubsub.publish("FEEDBACK_UPDATED", { feedbackUpdated: upDatedFeedback })
            return upDatedFeedback;
        },
        async login(_, { password, username }) {
            const usersDB = hasDB({ dbConfig, key: "usersDB" })

            const user = await usersDB.findOne({ username });
            if(user === null) throw new UserInputError("Username or password Invalid");

            if(await bcrypt.compare(password, user.password)) {
                return { name: user.name, username };
            } else {
                throw new UserInputError("Username or password Invalid");
            }
        },
        async registerUser(_, { user }) {
            const usersDB = hasDB({ dbConfig, key: "usersDB" })
            const { name, username, password } = user;

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
        feedbackDeleted: {
            subscribe: () => pubsub.asyncIterator(['FEEDBACK_DELETED'])
        },
        feedbackUpdated: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(['FEEDBACK_UPDATED']),
                (payload, variables) => {
                  // Only push an update if the comment is on
                  // the correct repository for this operation
                  //console.log(payload)
                  return (payload.feedbackUpdated.ID === variables.id || variables.id === "null");
                },
            ),
        }
    }
};

module.exports = { resolvers };