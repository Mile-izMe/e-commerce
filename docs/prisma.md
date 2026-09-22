# 1. Sinh artifacts từ contract.prisma

pnpm exec prisma contract emit

# 2. Tạo migration đầu tiên từ trạng thái trống

pnpm exec prisma migration plan --from db --name add_product_field

# 3. Kiểm tra migration và xem trước những migration sẽ chạy

pnpm exec prisma migration check
pnpm exec prisma db migrate --show

# 4. Ghi lại trạng thái vừa áp dụng để lần sau tạo migration nối tiếp đúng mốc.

pnpm exec prisma db migrate --advance-ref db

# 5. Kiểm tra kết quả

pnpm exec prisma db verify
pnpm exec prisma migration status
