import {
    BelongsTo,
    Column,
    DataType,
    Default,
    ForeignKey,
    HasMany,
    Index,
    IsUUID,
    Model,
    Table
} from 'sequelize-typescript'
import { fn } from 'sequelize'
import { Quote } from '~/models/quote.model'
import { Policy } from '~/models/policy.model'
import {
    AgentOnboardingStatus,
    AgentRole,
    AgentStatus
} from '~/enums/agents.enum'
import { Agency } from '~/models/agency.model'
import { ApiProperty } from '@nestjs/swagger'
import { AgentData } from '~/dtos'
import { get } from 'lodash'

@Table({})
export class Agent extends Model {
    @Default(fn('uuid_generate_v4'))
    @IsUUID(4)
    @Column({
        type: DataType.UUID,
        primaryKey: true,
        allowNull: false
    })
    id: string

    @Index({ unique: true })
    @ApiProperty({ example: 'test@test.com' })
    @Column({
        type: DataType.TEXT
    })
    email: string

    @ApiProperty({ example: '' })
    @Column({
        type: DataType.TEXT
    })
    firstName: string

    @ApiProperty({ example: '' })
    @Column({
        type: DataType.TEXT
    })
    lastName: string

    @ApiProperty({ example: '' })
    @Column({
        type: DataType.ENUM,
        values: Object.values(AgentRole),
        defaultValue: AgentRole.AGENT,
        allowNull: false
    })
    role: AgentRole

    @Column({
        type: DataType.TEXT
    })
    phone: string

    @Column({
        type: DataType.TEXT
    })
    agencyName: string

    @Column({
        type: DataType.ENUM,
        values: Object.values(AgentStatus),
        defaultValue: AgentStatus.ACTIVE,
        allowNull: false
    })
    status: AgentStatus

    @Column({
        type: DataType.ENUM,
        values: Object.values(AgentOnboardingStatus),
        defaultValue: AgentOnboardingStatus.ONBOARDING,
        allowNull: false
    })
    onboardingStatus: AgentOnboardingStatus

    @ForeignKey(() => Agency)
    @Column({
        type: DataType.UUID,
        allowNull: true
    })
    agencyId: string

    @BelongsTo(() => Agency, 'agencyId')
    agency: Agency

    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: {}
    })
    data: AgentData

    @HasMany(() => Quote, 'agentId')
    quotes: Quote[]

    @HasMany(() => Policy, 'agentId')
    policies: Policy[]
}
