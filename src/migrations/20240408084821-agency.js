'use strict'

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const { StateName } = await require('../enums')

        return await queryInterface.sequelize.transaction(
            async (transaction) => {
                await queryInterface.createTable(
                    'agencies',
                    {
                        id: {
                            allowNull: false,
                            primaryKey: true,
                            type: Sequelize.UUID,
                            defaultValue:
                                Sequelize.literal('uuid_generate_v4()')
                        },
                        email: {
                            type: Sequelize.STRING
                        },
                        phone: {
                            type: Sequelize.STRING,
                            allowNull: true
                        },
                        agencyName: {
                            type: Sequelize.STRING,
                            allowNull: true,
                            unique: true
                        },

                        documents: {
                            type: Sequelize.JSONB,
                            defaultValue: {}
                        },

                        parentAgencyId: {
                            type: Sequelize.UUID,
                            allowNull: true
                        },

                        data: {
                            type: Sequelize.JSONB,
                            defaultValue: {}
                        },

                        street: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },
                        state: {
                            type: Sequelize.ENUM(...Object.values(StateName)),
                            allowNull: false
                        },
                        zip_code: {
                            type: Sequelize.STRING,
                            allowNull: false
                        },

                        created_at: {
                            type: Sequelize.DATE
                        },
                        updated_at: {
                            type: Sequelize.DATE
                        },
                        deleted_at: {
                            type: Sequelize.DATE,
                            allowNull: true
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
                await queryInterface.dropTable('agencies', { transaction })
                const enumTypes = ['enum_agencies_state']
                for (const type of enumTypes) {
                    await queryInterface.sequelize.query(
                        `DROP TYPE IF EXISTS "${type}"`,
                        { transaction }
                    )
                }
            }
        )
    }
}
