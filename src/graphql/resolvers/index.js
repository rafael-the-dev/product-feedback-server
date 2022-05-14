const  { v4 } = require("uuid")
const { PubSub, withFilter } = require('graphql-subscriptions');
const bcrypt = require("bcrypt");
const { UserInputError } = require("apollo-server-express")
const jwt = require('jsonwebtoken');

const { dbConfig } = require("../../connections");
const { validator } = require("../../validations")
const { fetchByID, hasDB } = require("../../helpers")

const SECRET_KEY = '53a0d1a4174d2e1b8de701437fe06c08891035ed4fd945aef843a75bed2ade0657b3c4ff7ecd8474cb5180b2666c0688bbe640c9eb3d39bb9f2b724a10f343c6';

const pubsub = new PubSub();

const resolvers = {
    Query: {
        async feedbacks() {
            //console.log(context)
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
        async addComment(_, { comment }, { user }) {
            console.log(user)
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const { feedbackID } = comment;
            const feedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: feedbackID } });//await db.findOne({ ID: feedbackID });

            const ID = v4();
            const newComment = { ID, ...comment, user: { name: user.name, username: user.username } };
            const comments = [ ...feedback.comments, newComment];
            await db.updateOne({ ID: feedbackID }, { $set: { comments } });

            const upDatedFeedback = await db.findOne({ ID: feedbackID });

            pubsub.publish('FEEDBACK_UPDATED', { feedbackUpdated: upDatedFeedback }); 
            return upDatedFeedback;
        },
        async addCommentReply(_, { reply }, { user }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const { content, commentID, feedbackID, replyingTo } = reply;
            const feedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: feedbackID } });//await db.findOne({ ID: feedbackID });
            
            const comment = feedback.comments.find(item => item.ID === commentID);

            if(!Boolean(comment)) throw new Error("Comment not found");

            const newReply = { content, replyingTo, user: { name: user.name, username: user.username } };
            comment["replies"] = [ ...comment.replies, newReply ];
            await db.updateOne({ ID: feedbackID }, { $set: { comments: feedback.comments } });

            const upDatedFeedback = await db.findOne({ ID: feedbackID });
            pubsub.publish("FEEDBACK_UPDATED", { feedbackUpdated: upDatedFeedback });
            return upDatedFeedback;
        },
        async addFeedback(_, { feedback }, { user }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            const ID = v4();
            await db.insertOne({
                ID,
                ...feedback,
                comments: [],
                user: { name: user.name, username: user.username }
            });

            const result = await db.findOne({ ID });
            pubsub.publish('FEEDBACK_CREATED', { feedbackCreated: result }); 
            return result;
        },
        async deleteFeedback(_, { id }, { user }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: id } });//await db.findOne({ ID: id });
            
            if(feedback.user.username !== user.username ) throw new ForbiddenError("Only the author can delete this feedback")
            
            await db.deleteOne({ ID: id });
            const feedbackDeleted = { ID: id, status: "deleted" };
            pubsub.publish('FEEDBACK_DELETED', { feedbackDeleted }); 
            return feedbackDeleted;

        },
        async editFeedback(_, { feedback, id }, { user }) {
            const db = hasDB({ dbConfig, key: "feedbacksDB" })

            let savedFeedback = await fetchByID({ db, errorMessage: "Feedback not found", filter: { ID: id } });//await db.findOne({ ID: id });
            if(feedback.user.username !== user.username ) throw new ForbiddenError("Only the author can edit this feedback");
            
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
        async login(_, { password, username }, ) {
            const usersDB = hasDB({ dbConfig, key: "usersDB" })

            const user = await usersDB.findOne({ username });
            if(user === null) throw new UserInputError("Username or password Invalid");
            
            const acessToken = jwt.sign({ name: user.name, username }, SECRET_KEY, { expiresIn: "1h" });
            //console.log(acessToken)
            if(await bcrypt.compare(password, user.password)) {
                
                return { name: user.name, token: acessToken, username };
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
                throw new UserInputError("Username exists");
            } catch(err) {
                console.log(err)
            }
        },
        validateToken(_, { token }) {
            const user = jwt.verify(token, SECRET_KEY);
            return { name: user.name, token, username: user.username}
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