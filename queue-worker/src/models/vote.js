module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Vote', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    party: {
      type: DataTypes.ENUM('DEMOCRATIC', 'REPUBLICAN'),
      allowNull: false,
    }
  }, {
    underscored: true,
  });
};
