'use strict'

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const { StateName, CountyFips } = await require('../enums')
        return await queryInterface.sequelize.transaction(
            async (transaction) => {
                await queryInterface.createTable(
                    'addresses',
                    {
                        id: {
                            allowNull: false,
                            primaryKey: true,
                            type: Sequelize.UUID,
                            defaultValue:
                                Sequelize.literal('uuid_generate_v4()')
                        },
                        street: {
                            type: Sequelize.STRING,
                            allowNull: true
                        },
                        street2: {
                            type: Sequelize.STRING,
                            allowNull: true
                        },
                        county: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },
                        county_fips: {
                            type: Sequelize.ENUM(...Object.values(CountyFips)),
                            allowNull: false
                        },
                        city: {
                            type: Sequelize.STRING,
                            allowNull: true
                        },
                        state: {
                            type: Sequelize.ENUM(...Object.values(StateName)),
                            allowNull: false
                        },
                        zip_code: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },
                        longitude: {
                            type: Sequelize.FLOAT,
                            allowNull: true
                        },
                        latitude: {
                            type: Sequelize.FLOAT,
                            allowNull: true
                        },
                        smarty_data: {
                            type: Sequelize.JSONB,
                            allowNull: true
                        },
                        created_at: {
                            allowNull: false,
                            type: Sequelize.DATE
                        },
                        updated_at: {
                            allowNull: false,
                            type: Sequelize.DATE
                        },
                        deleted_at: {
                            allowNull: true,
                            type: Sequelize.DATE
                        }
                    },
                    { transaction }
                )
                // Add indexes
                await queryInterface.addIndex('addresses', ['zip_code'], {
                    transaction
                })
                await queryInterface.addIndex('addresses', ['county'], {
                    transaction
                })
                await queryInterface.addIndex('addresses', ['county_fips'], {
                    transaction
                })
                await queryInterface.addIndex('addresses', ['city'], {
                    transaction
                })
                await queryInterface.addIndex('addresses', ['state'], {
                    transaction
                })
                await queryInterface.addIndex(
                    'addresses',
                    ['street', 'city', 'state', 'zip_code'],
                    {
                        name: 'idx_addresses_full',
                        transaction
                    }
                )
                await queryInterface.addIndex('addresses', ['id'], {
                    name: 'idx_addresses_active',
                    where: {
                        deleted_at: null
                    },
                    transaction
                })
            }
        )
    },
    down: async (queryInterface) => {
        const { dropEnumTypesForTable } = await require('~/util')
        return await queryInterface.sequelize.transaction(
            async (transaction) => {
                await queryInterface.dropTable('addresses', { transaction })
                await dropEnumTypesForTable(
                    'addresses',
                    ['county_fips', 'state'],
                    queryInterface,
                    transaction
                )
            }
        )
    }
}
