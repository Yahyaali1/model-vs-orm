import {
    BeforeUpdate,
    BelongsTo,
    Column,
    DataType,
    Default,
    ForeignKey,
    HasMany,
    IsUUID,
    Model,
    Table
} from 'sequelize-typescript'
import { fn } from 'sequelize'
import { Agent } from '~/models/agent.model'
import { StateName } from '~/enums'
import type { AgencyDocuments } from '~/models/types/agency.types'
import { compact, get, join } from 'lodash'
import { AgencyBillingType, AscendProgramBillingType } from '~/dtos'

@Table({
    indexes: [
        {
            fields: ['agency_name'],
            unique: true
        }
    ]
})
export class Agency extends Model {
    @Default(fn('uuid_generate_v4'))
    @IsUUID(4)
    @Column({
        type: DataType.UUID,
        primaryKey: true,
        allowNull: false
    })
    id: string

    @Column({
        type: DataType.TEXT
    })
    email: string

    @Column({
        type: DataType.TEXT
    })
    phone: string

    @Column({
        type: DataType.TEXT
    })
    agencyName: string

    @ForeignKey(() => Agency)
    @Column({
        type: DataType.UUID,
        allowNull: true
    })
    parentAgencyId: string

    @BelongsTo(() => Agency, 'parentAgencyId')
    parentAgency: Agency

    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: {}
    })
    data: any

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    street: string

    @Column({
        type: DataType.STRING,
        allowNull: true
    })
    street2: string

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    city: string

    @Column({
        type: DataType.ENUM(...Object.values(StateName)),
        allowNull: false
    })
    state: string

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    zipCode: string

    @Column({
        type: DataType.JSONB,
        allowNull: true
    })
    documents: AgencyDocuments


}
