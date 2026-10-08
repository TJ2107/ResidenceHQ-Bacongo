from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime

@dataclass
class UserProfile:
    id: str
    username: str
    role: str  # 'admin' | 'manager' | 'receptionist' | 'barman' | 'cook' | etc.
    email: str
    isInvited: bool = False

    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str):
        return cls(
            id=doc_id,
            username=data.get('username', 'Utilisateur'),
            role=data.get('role', 'staff'),
            email=data.get('email', ''),
            isInvited=data.get('isInvited', False)
        )

    def to_dict(self):
        return asdict(self)


@dataclass
class Product:
    id: str
    name: str
    category: str
    price: float
    stock: int
    stockTerrasse: Optional[int] = 0
    stockReception: Optional[int] = 0
    stockVip: Optional[int] = 0

    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str):
        return cls(
            id=doc_id,
            name=data.get('name', ''),
            category=data.get('category', 'Boissons'),
            price=float(data.get('price', 0.0)),
            stock=int(data.get('stock', 0)),
            stockTerrasse=int(data.get('stockTerrasse', 0)) if data.get('stockTerrasse') is not None else 0,
            stockReception=int(data.get('stockReception', 0)) if data.get('stockReception') is not None else 0,
            stockVip=int(data.get('stockVip', 0)) if data.get('stockVip') is not None else 0
        )

    def to_dict(self):
        return asdict(self)


@dataclass
class SaleItem:
    productId: str
    productName: str
    category: str
    price: float
    quantity: int

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        return cls(
            productId=data.get('productId', ''),
            productName=data.get('productName', ''),
            category=data.get('category', ''),
            price=float(data.get('price', 0.0)),
            quantity=int(data.get('quantity', 0))
        )


@dataclass
class Sale:
    id: str
    items: List[SaleItem]
    totalPrice: float
    sellerId: str
    sellerName: str
    paymentMethod: str  # 'Cash' | 'Card' | 'Mobile Money' | 'Room Charge'
    timestamp: datetime
    location: str = 'Bar'  # 'Terrasse' | 'VIP' | 'Réception' | etc.
    roomId: Optional[str] = None
    tableNumber: Optional[str] = None
    kitchenStatus: str = 'Pending'  # 'Pending' | 'Preparing' | 'Ready' | etc.

    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str):
        items_data = data.get('items', [])
        items_list = [SaleItem.from_dict(item) for item in items_data]
        
        ts = data.get('timestamp')
        # Firestore timestamp conversion
        dt = ts if isinstance(ts, datetime) else datetime.now()
        if hasattr(ts, 'datetime'):  # Google cloud Timestamp object
            dt = ts.datetime

        return cls(
            id=doc_id,
            items=items_list,
            totalPrice=float(data.get('totalPrice', 0.0)),
            sellerId=data.get('sellerId', ''),
            sellerName=data.get('sellerName', 'Vendeur'),
            paymentMethod=data.get('paymentMethod', 'Cash'),
            timestamp=dt,
            location=data.get('location', 'Bar'),
            roomId=data.get('roomId'),
            tableNumber=data.get('tableNumber'),
            kitchenStatus=data.get('kitchenStatus', 'Pending')
        )

    def to_dict(self):
        result = asdict(self)
        result['items'] = [asdict(item) for item in self.items]
        return result


@dataclass
class Room:
    id: str
    number: str
    type: str  # e.g., 'Chambre de Luxe', 'Chambre Standard'
    price: float
    status: str  # 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance'
    currentGuestId: Optional[str] = None
    currentGuestName: Optional[str] = None
    checkInDate: Optional[datetime] = None
    expectedCheckOutDate: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str):
        check_in = data.get('checkInDate')
        check_out = data.get('expectedCheckOutDate')
        
        dt_in = check_in.datetime if hasattr(check_in, 'datetime') else check_in
        dt_out = check_out.datetime if hasattr(check_out, 'datetime') else check_out

        return cls(
            id=doc_id,
            number=data.get('number', ''),
            type=data.get('type', 'Chambre Standard'),
            price=float(data.get('price', 0.0)),
            status=data.get('status', 'Available'),
            currentGuestId=data.get('currentGuestId'),
            currentGuestName=data.get('currentGuestName'),
            checkInDate=dt_in,
            expectedCheckOutDate=dt_out
        )

    def to_dict(self):
        return asdict(self)


@dataclass
class Hall:
    id: str
    name: str
    type: str  # 'Salle de Fête', 'Salle Hammam', etc.
    price: float
    status: str  # 'Available' | 'Occupied' | 'Cleaning'
    currentGuestId: Optional[str] = None
    currentGuestName: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str):
        return cls(
            id=doc_id,
            name=data.get('name', ''),
            type=data.get('type', 'Salle de Fête'),
            price=float(data.get('price', 0.0)),
            status=data.get('status', 'Available'),
            currentGuestId=data.get('currentGuestId'),
            currentGuestName=data.get('currentGuestName')
        )

    def to_dict(self):
        return asdict(self)


@dataclass
class Booking:
    id: str
    roomId: str
    roomNumber: str
    guestId: str
    guestName: str
    checkInDate: datetime
    checkOutDate: datetime
    totalNights: int
    roomCharge: float
    posCharges: float
    totalPaid: float
    paymentMethod: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str):
        ch_in = data.get('checkInDate')
        ch_out = data.get('checkOutDate')
        
        dt_in = ch_in.datetime if hasattr(ch_in, 'datetime') else ch_in
        dt_out = ch_out.datetime if hasattr(ch_out, 'datetime') else ch_out

        return cls(
            id=doc_id,
            roomId=data.get('roomId', ''),
            roomNumber=data.get('roomNumber', ''),
            guestId=data.get('guestId', ''),
            guestName=data.get('guestName', ''),
            checkInDate=dt_in,
            checkOutDate=dt_out,
            totalNights=int(data.get('totalNights', 1)),
            roomCharge=float(data.get('roomCharge', 0.0)),
            posCharges=float(data.get('posCharges', 0.0)),
            totalPaid=float(data.get('totalPaid', 0.0)),
            paymentMethod=data.get('paymentMethod', 'Cash')
        )

    def to_dict(self):
        return asdict(self)


@dataclass
class Expense:
    id: str
    description: str
    amount: float
    category: str  # 'Salaries' | 'Utilities' | 'Stock' | 'Maintenance' | 'Other'
    timestamp: datetime
    recordedBy: str
    status: str = 'Pending'  # 'Pending' | 'Approved' | 'Rejected'

    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str):
        ts = data.get('timestamp')
        dt = ts.datetime if hasattr(ts, 'datetime') else ts

        return cls(
            id=doc_id,
            description=data.get('description', ''),
            amount=float(data.get('amount', 0.0)),
            category=data.get('category', 'Other'),
            timestamp=dt,
            recordedBy=data.get('recordedBy', ''),
            status=data.get('status', 'Pending')
        )

    def to_dict(self):
        return asdict(self)


@dataclass
class Guest:
    id: str
    name: str
    phone: str
    idNumber: str
    email: Optional[str] = None
    totalStays: int = 0

    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str):
        return cls(
            id=doc_id,
            name=data.get('name', ''),
            phone=data.get('phone', ''),
            idNumber=data.get('idNumber', ''),
            email=data.get('email'),
            totalStays=int(data.get('totalStays', 0))
        )

    def to_dict(self):
        return asdict(self)
