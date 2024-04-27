import mongoose, { Schema, Document } from 'mongoose';
ipmort dotenv from 'dotenv';

dotenv.config();

// Define a mongoose schema for the user data
interface UserDocument extends Document {
    logged_in: Date;
    logged_out: Date;
    lastSeenAt: Date;
}

const UserSchema = new Schema<UserDocument>({
    logged_in: Date,
    logged_out: Date,
    lastSeenAt: Date
});

const UserModel = mongoose.model<UserDocument>('User', UserSchema);

// Connect to MongoDB
mongoose.connect(process.env.URL, { useNewUrlParser: true, useUnifiedTopology: true });

// Function to calculate monthly logged-in and active users
async function calculateMonthlyActivity() {
    const pipeline = [
        {
            $project: {
                logged_in_month: { $month: "$logged_in" },
                last_seen_month: { $month: "$lastSeenAt" },
                user_id: 1
            }
        },
        {
            $group: {
                _id: { month: "$logged_in_month", user_id: "$user_id" },
                last_seen_month: { $first: "$last_seen_month" },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: "$_id.month",
                logged_in_users: { $sum: 1 },
                active_users: {
                    $sum: {
                        $cond: [
                            { $eq: ["$_id.month", "$last_seen_month"] },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                month: "$_id",
                logged_in_users: 1,
                active_users: 1
            }
        },
        {
            $sort: { month: 1 }
        }
    ];

    const monthlyActivity = await UserModel.aggregate(pipeline);
    return monthlyActivity;
}

// Call the function and handle the result
calculateMonthlyActivity()
    .then(monthlyActivity => {
        console.log("Monthly Activity:", monthlyActivity);
    })
    .catch(error => {
        console.error("Error:", error);
    });
