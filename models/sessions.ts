import {DataTypes} from "sequelize";
import sequelize from "../utils/db";


const SessionModel = sequelize.define('sessions', {
    device_id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    connection: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

export default SessionModel;
