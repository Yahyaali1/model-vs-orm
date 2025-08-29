'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add a 'country' column to store the country name or code.
      await queryInterface.addColumn(
        'Addresses', // Table name
        'country',   // New column name
        {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
          defaultValue: 'USA', // Set a default value, e.g., 'USA'
        },
        { transaction }
      );

      // Add a 'timezone' column to store the IANA time zone (e.g., "America/New_York").
      await queryInterface.addColumn(
        'Addresses',
        'timezone',
        {
          type: Sequelize.DataTypes.STRING,
          allowNull: true, // Allow null if timezone is not always available
        },
        { transaction }
      );

      // Add a boolean flag to identify if the address is residential.
      await queryInterface.addColumn(
        'Addresses',
        'isResidential',
        {
          type: Sequelize.DataTypes.BOOLEAN,
          allowNull: true, // Use true, false, or null if unknown
        },
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // The 'down' method should reverse the changes made in 'up'.
      await queryInterface.removeColumn('Addresses', 'isResidential', { transaction });
      await queryInterface.removeColumn('Addresses', 'timezone', { transaction });
      await queryInterface.removeColumn('Addresses', 'country', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
