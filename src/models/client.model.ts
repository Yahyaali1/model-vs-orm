import {
    Column,
    DataType,
    Default,
    IsUUID,
    Model,
    Table
} from 'sequelize-typescript'
import { fn } from 'sequelize'
import { Address } from './types'

@Table({})
export class Client extends Model {
    @Default(fn('uuid_generate_v4'))
    @IsUUID(4)
    @Column({
        type: DataType.UUID,
        primaryKey: true,
        allowNull: false
    })
    id: string

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    businessName: string

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    businessType: string

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    firstName: string

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    lastName: string


    @Column({
        type: DataType.JSONB,
        allowNull: true
    })
    billingAddress: Address

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    phone: string

    @Column({
        type: DataType.STRING,
        allowNull: false
    })
    email: string

    @Column({
        type: DataType.STRING,
        allowNull: true
    })
    alternativeEmail: string

    @Column({
        type: DataType.FLOAT,
        allowNull: false
    })
    revenueRangeFrom: number

    @Column({
        type: DataType.FLOAT,
        allowNull: false
    })
    revenueRangeTo: number

    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: {}
    })
    data: any
}
