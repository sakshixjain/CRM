const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Payment = sequelize.define(
  "Payment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
       company_id:{
      type:DataTypes.INTEGER,
      allowNull:false,
    },

    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    lead_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    caller_name:{
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    caller_id:{
      type:DataTypes.INTEGER,
      allowNull:false,
      defaultValue:0,
    },
    contact_no: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    case_location: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    case_type: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    duration: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    field_work: {
      type: DataTypes.ENUM("Yes", "No"),
      allowNull: false,
      defaultValue: "No",
    },

    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    received_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },

    pending_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },

    status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "assign",
    },
  },
  {
    tableName: "payments",
    timestamps: true,
    underscored: true, // created_at, updated_at
    indexes: [
      {
        unique: true,
        fields: ["company_id", "contact_no"],
        name: "payments_company_contact_no_unique",
      },
    ],
  }
);

// Auto-calculate pending amount
Payment.beforeSave((payment) => {
  payment.pending_amount =
    Number(payment.total_amount) - Number(payment.received_amount);
});

module.exports = Payment;
