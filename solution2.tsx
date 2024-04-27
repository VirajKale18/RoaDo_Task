import { MongoClient, Collection } from 'mongodb';

interface Trip {
    start: string;
    end: string;
}

interface Shipment {
    pickups: string[];
    drops: string[];
    warehouse?: string;
}

async function validateTripsWithMongoDB(trips: Trip[], shipment: Shipment): Promise<boolean> {
    const uri = 'mongodb://localhost:27017';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('your_database_name');
        const tripsCollection: Collection<Trip> = db.collection('trips');

        const pipeline = [
            {
                $match: {
                    $or: [
                        { start: { $in: shipment.pickups } },
                        { end: { $in: shipment.drops } }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    visitedPoints: { $addToSet: "$start" },
                    pickups: { $addToSet: "$start" },
                    drops: { $addToSet: "$end" }
                }
            },
            {
                $addFields: {
                    allPoints: { $concatArrays: ["$pickups", "$drops"] }
                }
            },
            {
                $project: {
                    visitedPoints: 1,
                    allPoints: 1,
                    warehouse: shipment.warehouse
                }
            },
            {
                $addFields: {
                    visitedAllPoints: {
                        $eq: [{ $size: "$visitedPoints" }, { $size: "$allPoints" }]
                    }
                }
            },
            {
                $addFields: {
                    visitedWarehouse: {
                        $cond: [
                            { $eq: [{ $size: ["$visitedPoints", "$warehouse"] }, 2] },
                            true,
                            false
                        ]
                    }
                }
            },
            {
                $project: {
                    isValid: {
                        $and: [
                            "$visitedAllPoints",
                            { $cond: [{ $eq: ["$warehouse", undefined] }, true, "$visitedWarehouse"] }
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    isValid: 1
                }
            }
        ];

        const result = await tripsCollection.aggregate(pipeline).toArray();
        return result.length > 0 && result[0].isValid;
    } finally {
        await client.close();
    }
}

// Example usage:
const shipment: Shipment = {
    pickups: ['A', 'B'],
    drops: ['C', 'D'],
    warehouse: 'W'
};

const trips: Trip[] = [
    { start: 'A', end: 'W' },
    { start: 'B', end: 'W' },
    { start: 'W', end: 'C' },
    { start: 'W', end: 'D' }
];

validateTripsWithMongoDB(trips, shipment)
    .then(isValid => {
        console.log("Trips are valid:", isValid);
    })
    .catch(error => {
        console.error("Error:", error);
    });
