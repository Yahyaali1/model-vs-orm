@Table({
    indexes: [
        {
            fields: ['zip_code']
        },
        {
            fields: ['county']
        },
        {
            fields: ['county_fips']
        },
        {
            fields: ['city']
        },
        {
            fields: ['state']
        }
    ]
})
export class Address extends Model<CreateAddressParams> {
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
        allowNull: true
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
    county: string

    @Column({
        type: DataType.ENUM(...Object.values(CountyFips)),
        allowNull: false,
        validate: {
            isInCountyFips
        }
    })
    countyFips: string

    @Column({
        type: DataType.STRING,
        allowNull: true
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
        type: DataType.FLOAT,
        allowNull: true
    })
    longitude: number

    @Column({
        type: DataType.FLOAT,
        allowNull: true
    })
    latitude: number

    @Column({
        type: DataType.JSONB,
        allowNull: true
    })
    smartyData: usStreet.Candidate
}
