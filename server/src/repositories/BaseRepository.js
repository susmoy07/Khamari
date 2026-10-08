export class BaseRepository {
  constructor(pool, tableName) {
    this.pool = pool;
    this.tableName = tableName;
  }

  getExecutor(connection = null) {
    return connection || this.pool;
  }

  async findById(id, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT * FROM ${this.tableName} WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  async deleteById(id, connection = null) {
    const executor = this.getExecutor(connection);
    const [result] = await executor.execute(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  async withTransaction(workFn) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await workFn(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
