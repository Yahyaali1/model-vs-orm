'use strict'
module.exports = {
    up: async (queryInterface, Sequelize) => {
        return await queryInterface.sequelize.transaction(
            async (transaction) => {
                await queryInterface.createTable(
                    'clients',
                    {
                        id: {
                            allowNull: false,
                            primaryKey: true,
                            type: Sequelize.UUID,
                            defaultValue:
                                Sequelize.literal('uuid_generate_v4()')
                        },
                        businessName: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },
                        firstName: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },
                        last_name: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },
                        mailing_address: {
                            type: Sequelize.JSONB,
                            allowNull: false
                        },
                        billing_address: {
                            type: Sequelize.JSONB,
                            allowNull: false
                        },
                        phone: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },
                        email: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },
                        alternative_email: {
                            type: Sequelize.STRING,
                            allowNull: true
                        },
                        revenue_range_from: {
                            type: Sequelize.FLOAT,
                            allowNull: false
                        },
                        revenue_range_to: {
                            type: Sequelize.FLOAT,
                            allowNull: false
                        },
                        data: {
                            type: Sequelize.JSONB,
                            defaultValue: {}
                        }
                    },
                    { transaction }
                )
            }
        )
    },
    down: async (queryInterface) => {
        return await queryInterface.sequelize.transaction(
            async (transaction) => {
                await queryInterface.dropTable('insureds', transaction)
            }
        )
    }
}
